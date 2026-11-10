import type { PlayerId } from '../engines/engine.js';
import type { Ack, ServerToClient, TableSnapshot } from '../ws/protocol.js';
import type { GameSession } from './game-session.js';

export type Table = TableSnapshot & { session?: GameSession };

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

export const OK: Ack = { ok: true };
export const fail = (reason: string): Ack => ({ ok: false, reason });

export const toSnapshot = (table: Table): TableSnapshot => ({
  id: table.id,
  gameId: table.gameId,
  hostId: table.hostId,
  players: [...table.players],
  status: table.status,
  settings: table.settings,
});
