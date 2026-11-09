import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { GameResult, PlayerId } from '../engines/engine.js';
import { getEngine, type AnyEngine } from '../engines/registry.js';
import type { Ack, TableSettings, TableSnapshot } from '../ws/protocol.js';
import { GracePeriods } from './grace-periods.js';
import { GameSession } from './game-session.js';
import {
  fail,
  OK,
  tableRoom,
  toSnapshot,
  userRoom,
  type Hub,
  type Table,
} from './table.js';

const MAX_CHAT_LENGTH = 500;
const MIN_TIME_SECONDS = 60;
const MAX_TIME_SECONDS = 3600;
const DEFAULT_GRACE_MS = 30_000;
const MAX_EVENTS_PER_SECOND = 5;

@Injectable()
export class TablesService {
  hub!: Hub;
  getEngine: (id: string) => AnyEngine | undefined = getEngine;

  graceMs = DEFAULT_GRACE_MS;

  private tables = new Map<string, Table>();
  private seats = new Map<PlayerId, Table>();
  private grace = new GracePeriods();
  private recent = new Map<PlayerId, number[]>();

  getTables(gameId: string): TableSnapshot[] {
    return [...this.tables.values()]
      .filter(
        (t) =>
          t.gameId === gameId && t.status === 'lobby' && !t.settings.private,
      )
      .map(toSnapshot);
  }

  create(userId: PlayerId, gameId: string, settings: TableSettings): Ack {
    if (this.seatOf(userId)) {
      return fail('already at a table');
    }

    const engine = this.getEngine(gameId);

    if (!engine) {
      return fail('unknown game');
    }

    const max = settings?.maxPlayers;

    if (
      !Number.isInteger(max) ||
      max < engine.minPlayers ||
      max > engine.maxPlayers
    ) {
      return fail('invalid player limit');
    }

    const timeSeconds = settings?.timeSeconds;

    if (
      !Number.isInteger(timeSeconds) ||
      timeSeconds < MIN_TIME_SECONDS ||
      timeSeconds > MAX_TIME_SECONDS
    ) {
      return fail('invalid time limit');
    }

    const table: Table = {
      id: randomUUID(),
      gameId,
      hostId: userId,
      players: [],
      status: 'lobby',
      settings: {
        maxPlayers: max,
        private: Boolean(settings.private),
        timeSeconds,
      },
    };

    this.tables.set(table.id, table);
    this.addPlayerToTable(table, userId);

    return OK;
  }

  join(userId: PlayerId, tableId: string): Ack {
    if (this.seatOf(userId)) {
      return fail('already at a table');
    }

    const table = this.tables.get(tableId);

    if (!table) {
      return fail('no such table');
    }

    if (table.status !== 'lobby') {
      return fail('game already started');
    }

    if (table.players.length >= table.settings.maxPlayers) {
      return fail('table is full');
    }

    this.addPlayerToTable(table, userId);
    this.hub.emit(tableRoom(table.id), 'chat:message', {
      from: userId,
      event: 'joined',
    });

    return OK;
  }

  leave(userId: PlayerId): Ack {
    this.grace.cancel(userId);
    this.recent.delete(userId);

    const table = this.seatOf(userId);
    if (!table) {
      return fail('not at a table');
    }

    const wasPlaying = Boolean(table.session);
    const wasDuel = table.players.length === 2;
    this.deletePlayerFromTable(table, userId);

    if (table.players.length === 0) {
      table.session?.stop();
      this.tables.delete(table.id);
      return OK;
    }

    if (table.hostId === userId) table.hostId = table.players[0];
    this.hub.emit(tableRoom(table.id), 'chat:message', {
      from: userId,
      event: 'left',
    });

    if (!wasPlaying) {
      this.broadcastTable(table);
    } else if (wasDuel) {
      this.endGame(table, { [userId]: 'loss', [table.players[0]]: 'win' });
    } else {
      this.abortGame(table, userId);
    }
    return OK;
  }

  start(userId: PlayerId): Ack {
    const table = this.seatOf(userId);
    if (!table) {
      return fail('not at a table');
    }

    if (table.hostId !== userId) {
      return fail('only the host can start');
    }

    if (table.status !== 'lobby') {
      return fail('game already started');
    }

    const engine = this.getEngine(table.gameId)!;
    if (table.players.length < engine.minPlayers) {
      return fail('not enough players');
    }

    table.session = new GameSession(
      table.id,
      engine,
      table.players,
      table.settings.timeSeconds * 1000,
      this.hub,
      (result) => this.endGame(table, result),
      () => this.abortGame(table),
    );
    table.status = 'playing';

    this.broadcastTable(table);
    table.session.start();

    return OK;
  }

  action(userId: PlayerId, action: unknown): Ack {
    const session = this.seatOf(userId)?.session;

    if (this.tooFast(userId)) return fail('too fast');

    return session
      ? session.action(userId, action)
      : fail('no game in progress');
  }

  chat(userId: PlayerId, text: string): Ack {
    const table = this.seatOf(userId);

    if (!table) {
      return fail('not at a table');
    }

    if (this.tooFast(userId)) return fail('too fast');

    const trimmed = typeof text === 'string' ? text.trim() : '';

    if (!trimmed || trimmed.length > MAX_CHAT_LENGTH) {
      return fail('invalid message');
    }

    this.hub.emit(tableRoom(table.id), 'chat:message', {
      from: userId,
      text: trimmed,
    });

    return OK;
  }

  disconnect(userId: PlayerId): void {
    if (!this.seatOf(userId)) return;

    this.grace.start(userId, this.graceMs, () => this.leave(userId));
  }

  reconnect(userId: PlayerId): void {
    this.grace.cancel(userId);

    const table = this.seatOf(userId);
    if (!table) return;

    this.hub.join(userId, tableRoom(table.id));
    this.hub.emit(userRoom(userId), 'table:state', toSnapshot(table));
    table.session?.resync(userId);
  }

  private seatOf(userId: PlayerId): Table | undefined {
    return this.seats.get(userId);
  }

  // chat messages and moves share one budget per player
  private tooFast(userId: PlayerId): boolean {
    const now = Date.now();
    const recent = (this.recent.get(userId) ?? []).filter(
      (t) => now - t < 1000,
    );
    recent.push(now);
    this.recent.set(userId, recent);
    return recent.length > MAX_EVENTS_PER_SECOND;
  }

  private addPlayerToTable(table: Table, userId: PlayerId): void {
    table.players.push(userId);
    this.seats.set(userId, table);
    this.hub.join(userId, tableRoom(table.id));
    this.broadcastTable(table);
  }

  private deletePlayerFromTable(table: Table, userId: PlayerId): void {
    table.players = table.players.filter((p) => p !== userId);
    this.seats.delete(userId);
    this.hub.leave(userId, tableRoom(table.id));
  }

  private broadcastTable(table: Table): void {
    this.hub.emit(tableRoom(table.id), 'table:state', toSnapshot(table));
  }

  private endGame(table: Table, result: GameResult): void {
    this.hub.emit(tableRoom(table.id), 'game:over', { result });
    this.backToLobby(table);
  }

  // no leaver: the game was stopped by a server error
  private abortGame(table: Table, leaver?: PlayerId): void {
    this.hub.emit(tableRoom(table.id), 'game:aborted', { leaver });
    this.backToLobby(table);
  }

  private backToLobby(table: Table): void {
    table.session?.stop();
    table.session = undefined;
    table.status = 'lobby';
    this.broadcastTable(table);
  }
}
