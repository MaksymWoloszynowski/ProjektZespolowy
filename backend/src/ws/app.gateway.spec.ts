import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { TablesService } from '../tables/tables.service.js';
import { AppGateway } from './app.gateway.js';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('cookie');
      return id ? { user: { id } } : null;
    },
  },
};

type Seen = { event: string; data: any };

describe('AppGateway over real sockets', () => {
  let io: Server;
  let port: number;
  let tables: TablesService;
  const clients: Socket[] = [];

  async function startServer() {
    const http = createServer();
    io = new Server(http);
    tables = new TablesService();
    const gateway = new AppGateway(fakeAuth as never, tables);
    gateway.server = io;
    gateway.afterInit(io);
    io.on('connection', (socket) => {
      gateway.handleConnection(socket);
      socket.on('disconnect', () => void gateway.handleDisconnect(socket));
    });
    await new Promise<void>((resolve) => http.listen(0, resolve));
    port = (http.address() as AddressInfo).port;
  }

  function client(userId?: string) {
    const socket = connect(`http://localhost:${port}`, {
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
      extraHeaders: userId ? { cookie: userId } : {},
    });
    const seen: Seen[] = [];
    socket.onAny((event, data) => seen.push({ event, data }));
    clients.push(socket);
    return { socket, seen };
  }

  async function until<T>(find: () => T | undefined): Promise<T> {
    for (let i = 0; i < 200; i++) {
      const hit = find();
      if (hit !== undefined) return hit;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('timed out waiting');
  }

  const event = (seen: Seen[], name: string, where?: (data: any) => boolean) =>
    until(
      () =>
        seen.find((s) => s.event === name && (!where || where(s.data)))?.data,
    );

  const connected = (c: { socket: Socket }) =>
    new Promise<void>((resolve, reject) => {
      c.socket.once('connect', resolve);
      c.socket.once('connect_error', reject);
      c.socket.connect();
    });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    await io.close();
  });

  it('refuses a socket without a session', async () => {
    await startServer();
    const anonymous = client();
    await expect(connected(anonymous)).rejects.toThrow('unauthorized');
  });

  it('gives a player who reconnects the table, the board and the table broadcasts', async () => {
    await startServer();
    const a = client('a');
    const b = client('b');
    await connected(a);
    await connected(b);

    tables.create('a', 'checkers', {
      maxPlayers: 2,
      private: false,
      timeSeconds: 300,
    });
    const { id } = await event(a.seen, 'table:state');
    tables.join('b', id);
    tables.start('a');
    await event(b.seen, 'game:state');

    b.socket.close();
    await until(() => (io.sockets.sockets.size === 1 ? true : undefined));
    const back = client('b');
    await connected(back);

    expect(
      (await event(back.seen, 'table:state', (t) => t.status === 'playing')).id,
    ).toBe(id);
    await event(back.seen, 'game:state');
    await event(back.seen, 'game:clock');

    tables.leave('a');
    expect((await event(back.seen, 'game:over')).result).toEqual({
      a: 'loss',
      b: 'win',
    });
  });
});
