import type { GameResult, PlayerId } from '../engines/engine.js';

export type Ack = { ok: true } | { ok: false; reason: string };

export type TableSettings = {
  maxPlayers: number;
  private: boolean;
  turnSeconds?: number;
};
export type TableStatus = 'lobby' | 'playing';

export type TableSnapshot = {
  id: string;
  gameId: string;
  hostId: PlayerId;
  players: PlayerId[];
  status: TableStatus;
  settings: TableSettings;
};

export interface ClientToServer {
  'table:create': (
    data: { gameId: string; settings: TableSettings },
    ack: (res: Ack) => void,
  ) => void;
  'table:join': (data: { tableId: string }, ack: (res: Ack) => void) => void;
  'table:leave': (ack: (res: Ack) => void) => void;
  'table:start': (ack: (res: Ack) => void) => void;
  'game:action': (data: { action: unknown }, ack: (res: Ack) => void) => void;
  'chat:send': (data: { text: string }, ack: (res: Ack) => void) => void;
}

export interface ServerToClient {
  'table:state': (table: TableSnapshot) => void;
  'game:state': (data: { view: unknown }) => void;
  'game:over': (data: { result: GameResult }) => void;
  'chat:message': (
    data:
      | { from: PlayerId; text: string }
      | { from: PlayerId; event: 'joined' | 'left' },
  ) => void;
  'table:closed': (data: { reason: string }) => void;
}
