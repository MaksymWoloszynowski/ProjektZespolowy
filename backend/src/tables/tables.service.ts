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

type Table = TableSnapshot & { state?: unknown; timer?: NodeJS.Timeout };

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

@Injectable()
export class TablesService {
  hub!: Hub;
  getEngine: (id: string) => AnyEngine | undefined = getEngine;

  private tables = new Map<string, Table>();

  getTables(gameId: string): TableSnapshot[] {
    return Array.from(this.tables.values())
      .map((table) => {
        const { state: _state, timer: _timer, ...snapshot } = table;
        return snapshot;
      })
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

    const table: Table = {
      id: randomUUID(),
      gameId,
      hostId: userId,
      players: [],
      status: 'lobby',
      settings: {
        maxPlayers: max,
        private: Boolean(settings.private),
        turnSeconds: settings.turnSeconds,
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

  leave(userId: PlayerId): Ack {
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
    const res = engine.applyAction(table.state, userId, action);

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

  private deletePlayerFromTable(table: Table, userId: PlayerId): void {
    table.players = table.players.filter((p) => p !== userId);
    this.hub.leave(userId, tableRoom(table.id));
  }

  private close(table: Table, reason: string): void {
    clearTimeout(table.timer);
    this.hub.emit(tableRoom(table.id), 'table:closed', { reason });
    for (const p of table.players) this.deletePlayerFromTable(table, p);
    this.tables.delete(table.id);
  }

  private broadcastTable(table: Table): void {
    const { state: _state, timer: _timer, ...snapshot } = table;
    this.hub.emit(tableRoom(table.id), 'table:state', snapshot);
  }

  // every state change goes through here: per-player views, end of game, turn timer
  private afterStateChange(table: Table, engine: AnyEngine): void {
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
      this.broadcastTable(table);
      return;
    }
    const seconds = table.settings.turnSeconds;
    if (seconds) {
      table.timer = setTimeout(() => {
        table.state = engine.onTurnTimeout(table.state);
        this.afterStateChange(table, engine);
      }, seconds * 1000);
    }
  }
}
