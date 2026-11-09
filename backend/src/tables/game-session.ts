import { Logger } from '@nestjs/common';
import type { GameResult, PlayerId } from '../engines/engine.js';
import type { AnyEngine } from '../engines/registry.js';
import type { Ack } from '../ws/protocol.js';
import { GameClock } from './game-clock.js';
import { fail, OK, tableRoom, userRoom, type Hub } from './table.js';

export class GameSession {
  private state: unknown;
  private readonly players: PlayerId[];
  private readonly clock: GameClock;
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(GameSession.name);

  constructor(
    private readonly tableId: string,
    private readonly engine: AnyEngine,
    players: PlayerId[],
    poolMs: number,
    private readonly hub: Hub,
    private readonly onOver: (result: GameResult) => void,
    private readonly onError: () => void,
  ) {
    this.players = [...players];
    this.state = engine.createInitialState(this.players);
    this.clock = new GameClock(this.players, poolMs);
  }

  start(): void {
    this.guard(() => this.settle());
  }

  stop(): void {
    clearTimeout(this.timer);
  }

  action(userId: PlayerId, action: unknown): Ack {
    this.clock.charge();
    if (this.clock.isExpired()) {
      this.timeout();
      return fail('time is up');
    }

    let res: ReturnType<AnyEngine['applyAction']>;
    try {
      res = this.engine.applyAction(this.state, userId, action);
    } catch {
      return fail('invalid action');
    }
    if (!res.ok) return fail(res.reason);

    this.state = res.state;
    this.guard(() => this.settle());
    return OK;
  }

  resync(userId: PlayerId): void {
    this.hub.emit(userRoom(userId), 'game:state', {
      view: this.engine.getPlayerView(this.state, userId),
    });
    this.clock.charge();
    this.hub.emit(userRoom(userId), 'game:clock', this.clock.toEvent());
  }

  private timeout(): void {
    this.guard(() => {
      this.clock.charge();
      this.clock.zeroLowest();
      this.state = this.engine.onTurnTimeout(this.state);
      this.settle(true);
    });
  }

  private guard(run: () => void): void {
    try {
      run();
    } catch (err) {
      this.logger.error(`engine failed at table ${this.tableId}`, err);
      this.stop();
      this.onError();
    }
  }

  private settle(fromTimeout = false): void {
    clearTimeout(this.timer);
    for (const p of this.players) {
      this.hub.emit(userRoom(p), 'game:state', {
        view: this.engine.getPlayerView(this.state, p),
      });
    }

    const result = this.engine.getResult(this.state);
    if (result) {
      this.onOver(result);
      return;
    }

    const active = this.engine.getActivePlayers(this.state);
    this.clock.activate(active);
    this.hub.emit(tableRoom(this.tableId), 'game:clock', this.clock.toEvent());
    if (active.length === 0) return;

    const remaining = this.clock.remainingMs();
    if (fromTimeout && remaining <= 0) return;

    this.timer = setTimeout(() => this.timeout(), remaining);
  }
}
