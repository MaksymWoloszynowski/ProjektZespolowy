import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { Server, Socket } from 'socket.io';
import { TablesService } from '../tables/tables.service.js';
import { userRoom } from '../tables/table.js';
import type { Ack, TableSettings } from './protocol.js';

@WebSocketGateway({
  cors: {
    origin: (origin, cb) =>
      cb(
        null,
        origin === (process.env.FRONTEND_URL ?? 'http://localhost:5173'),
      ),
    credentials: true,
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly tablesService: TablesService,
  ) {}

  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      const session = await this.authService.api
        .getSession({ headers: fromNodeHeaders(socket.handshake.headers) })
        .catch(() => null);

      if (!session) {
        return next(new Error('unauthorized'));
      }

      socket.data.userId = session.user.id;
      socket.join(userRoom(session.user.id));

      next();
    });

    this.tablesService.hub = {
      join: (userId, room) => server.in(userRoom(userId)).socketsJoin(room),
      leave: (userId, room) => server.in(userRoom(userId)).socketsLeave(room),
      emit: (room, event, ...args) => server.to(room).emit(event, ...args),
    };
  }

  handleConnection(client: Socket): void {
    this.tablesService.reconnect(client.data.userId);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId: string = client.data.userId;

    if (!userId) return;

    const sockets = await this.server.in(userRoom(userId)).fetchSockets();

    if (sockets.length === 0) {
      this.tablesService.disconnect(userId);
    }
  }

  @SubscribeMessage('table:create')
  create(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; settings: TableSettings },
  ): Ack {
    return this.tablesService.create(
      client.data.userId,
      data?.gameId,
      data?.settings,
    );
  }

  @SubscribeMessage('table:join')
  join(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string },
  ): Ack {
    return this.tablesService.join(client.data.userId, data?.tableId);
  }

  @SubscribeMessage('table:leave')
  leave(@ConnectedSocket() client: Socket): Ack {
    return this.tablesService.leave(client.data.userId);
  }

  @SubscribeMessage('table:start')
  start(@ConnectedSocket() client: Socket): Ack {
    return this.tablesService.start(client.data.userId);
  }

  @SubscribeMessage('game:action')
  action(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { action: unknown },
  ): Ack {
    return this.tablesService.action(client.data.userId, data?.action);
  }

  @SubscribeMessage('chat:send')
  chat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ): Ack {
    return this.tablesService.chat(client.data.userId, data?.text);
  }
}
