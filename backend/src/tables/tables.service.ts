import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getEngine, type AnyEngine } from '../engines/registry.js';
import type { PlayerId } from '../engines/engine.js';
import type {
  Ack,
  ServerToClient,
  TableSettings,
  TableSnapshot,
} from '../ws/protocol.js';

type Table = TableSnapshot & {
  state?: unknown;
  timer?: NodeJS.Timeout;
  clocks?: Record<PlayerId, number>;
  active?: PlayerId[];
  clockStartedAt?: number;
};

export interface Hub {
  join(userId: PlayerId, room: string): void;
  leave(userId: PlayerId, room: string): void;
  emit<E extends keyof ServerToClient>(
    room: string,
    event: E,
    ...args: Parameters<ServerToClient[E]>
  ): void;
}

export const userRoom = (userId: PlayerId) => `user:${userId}`;
export const tableRoom = (tableId: string) => `table:${tableId}`;

const OK: Ack = { ok: true };
const fail = (reason: string): Ack => ({ ok: false, reason });
const MAX_CHAT_LENGTH = 500;
const MIN_TIME_SECONDS = 60;
const MAX_TIME_SECONDS = 3600;
const DEFAULT_GRACE_MS = 30_000;

@Injectable()
export class TablesService {
  hub!: Hub;
  getEngine: (id: string) => AnyEngine | undefined = getEngine;

  graceMs = DEFAULT_GRACE_MS;

  private tables = new Map<string, Table>();
  private graceTimers = new Map<PlayerId, NodeJS.Timeout>();

  getTables(gameId: string): TableSnapshot[] {
    return Array.from(this.tables.values())
      .map((table) => this.toSnapshot(table))
      .filter(
        (snapshot) =>
          snapshot.gameId === gameId &&
          snapshot.status === 'lobby' &&
          !snapshot.settings.private,
      );
  }

  create(userId: PlayerId, gameId: string, settings: TableSettings): Ack {
    if (this.findTableFromUser(userId)) {
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
    if (this.findTableFromUser(userId)) {
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

  disconnect(userId: PlayerId): void {
    if (!this.findTableFromUser(userId)) return;

    this.clearGrace(userId);
    this.graceTimers.set(
      userId,
      setTimeout(() => {
        this.graceTimers.delete(userId);
        this.leave(userId);
      }, this.graceMs),
    );
  }

  reconnect(userId: PlayerId): void {
    this.clearGrace(userId);

    const table = this.findTableFromUser(userId);
    if (!table) return;

    // a new socket is not in the table room yet, only in the user's own room
    this.hub.join(userId, tableRoom(table.id));
    this.hub.emit(userRoom(userId), 'table:state', this.toSnapshot(table));

    if (table.status === 'playing') {
      const engine = this.getEngine(table.gameId)!;
      this.hub.emit(userRoom(userId), 'game:state', {
        view: engine.getPlayerView(table.state, userId),
      });
      this.charge(table);
      this.broadcastClock(table, userRoom(userId));
    }
  }

  leave(userId: PlayerId): Ack {
    this.clearGrace(userId);

    const table = this.findTableFromUser(userId);
    if (!table) {
      return fail('not at a table');
    }

    this.deletePlayerFromTable(table, userId);

    if (table.status === 'playing') {
      this.close(table, 'a player left the game');
    } else if (table.players.length === 0) {
      this.tables.delete(table.id);
    } else {
      if (table.hostId === userId) table.hostId = table.players[0];
      this.hub.emit(tableRoom(table.id), 'chat:message', {
        from: userId,
        event: 'left',
      });
      this.broadcastTable(table);
    }
    return OK;
  }

  start(userId: PlayerId): Ack {
    const table = this.findTableFromUser(userId);
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

    table.state = engine.createInitialState(table.players);
    table.status = 'playing';

    const poolMs = table.settings.timeSeconds * 1000;
    table.clocks = Object.fromEntries(table.players.map((p) => [p, poolMs]));

    this.broadcastTable(table);
    this.afterStateChange(table, engine);

    return OK;
  }

  action(userId: PlayerId, action: unknown): Ack {
    const table = this.findTableFromUser(userId);

    if (!table || table.status !== 'playing') {
      return fail('no game in progress');
    }

    const engine = this.getEngine(table.gameId)!;

    this.charge(table);
    if (table.active!.some((p) => table.clocks![p] <= 0)) {
      this.expire(table, engine);
      return fail('time is up');
    }

    let res: ReturnType<AnyEngine['applyAction']>;

    try {
      res = engine.applyAction(table.state, userId, action);
    } catch {
      return fail('invalid action');
    }

    if (!res.ok) {
      return fail(res.reason);
    }

    table.state = res.state;
    this.afterStateChange(table, engine);

    return OK;
  }

  chat(userId: PlayerId, text: string): Ack {
    const table = this.findTableFromUser(userId);

    if (!table) {
      return fail('not at a table');
    }

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

  private findTableFromUser(userId: PlayerId): Table | undefined {
    return [...this.tables.values()].find((t) => t.players.includes(userId));
  }

  private addPlayerToTable(table: Table, userId: PlayerId): void {
    table.players.push(userId);
    this.hub.join(userId, tableRoom(table.id));
    this.broadcastTable(table);
  }

  private clearGrace(userId: PlayerId): void {
    clearTimeout(this.graceTimers.get(userId));
    this.graceTimers.delete(userId);
  }

  private deletePlayerFromTable(table: Table, userId: PlayerId): void {
    table.players = table.players.filter((p) => p !== userId);
    this.hub.leave(userId, tableRoom(table.id));
  }

  private close(table: Table, reason: string): void {
    clearTimeout(table.timer);
    this.hub.emit(tableRoom(table.id), 'table:closed', { reason });
    for (const p of table.players) {
      this.clearGrace(p);
      this.deletePlayerFromTable(table, p);
    }
    this.tables.delete(table.id);
  }

  private toSnapshot(table: Table): TableSnapshot {
    return {
      id: table.id,
      gameId: table.gameId,
      hostId: table.hostId,
      players: [...table.players],
      status: table.status,
      settings: table.settings,
    };
  }

  private broadcastTable(table: Table): void {
    this.hub.emit(tableRoom(table.id), 'table:state', this.toSnapshot(table));
  }

  private broadcastClock(table: Table, room: string): void {
    this.hub.emit(room, 'game:clock', {
      clocks: { ...table.clocks },
      active: [...(table.active ?? [])],
    });
  }

  // takes the time elapsed since the last charge off the pools of the players on turn
  private charge(table: Table): void {
    const now = Date.now();
    const elapsed = now - (table.clockStartedAt ?? now);
    table.clockStartedAt = now;
    for (const p of table.active ?? []) {
      table.clocks![p] = Math.max(0, table.clocks![p] - elapsed);
    }
  }

  // a pool ran out: the engine decides what that means (checkers: the player loses)
  private expire(table: Table, engine: AnyEngine): void {
    this.charge(table);
    const active = table.active ?? [];
    const lowest = Math.min(...active.map((p) => table.clocks![p]));
    for (const p of active) {
      if (table.clocks![p] === lowest) table.clocks![p] = 0;
    }
    table.state = engine.onTurnTimeout(table.state);
    this.afterStateChange(table, engine, true);
  }

  // every state change goes through here: per-player views, end of game, clocks
  private afterStateChange(
    table: Table,
    engine: AnyEngine,
    fromTimeout = false,
  ): void {
    clearTimeout(table.timer);
    for (const p of table.players) {
      this.hub.emit(userRoom(p), 'game:state', {
        view: engine.getPlayerView(table.state, p),
      });
    }
    const result = engine.getResult(table.state);
    if (result) {
      // step 6 persists the match (result, ELO, counters) here
      this.hub.emit(tableRoom(table.id), 'game:over', { result });
      table.status = 'lobby';
      table.state = undefined;
      table.clocks = undefined;
      table.active = undefined;
      table.clockStartedAt = undefined;
      this.broadcastTable(table);
      return;
    }

    table.active = engine.getActivePlayers(table.state);
    table.clockStartedAt = Date.now();
    this.broadcastClock(table, tableRoom(table.id));

    if (table.active.length === 0) return;

    const remaining = Math.min(...table.active.map((p) => table.clocks![p]));
    // the engine did not settle the timeout: do not spin on an empty pool
    if (fromTimeout && remaining <= 0) return;

    table.timer = setTimeout(() => this.expire(table, engine), remaining);
  }
}
