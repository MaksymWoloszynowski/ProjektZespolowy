import type { PlayerId } from '../engines/engine.js';
import type { ServerToClient } from '../ws/protocol.js';

export type ClockEvent = Parameters<ServerToClient['game:clock']>[0];

export class GameClock {
  private readonly pools: Record<PlayerId, number>;
  private active: PlayerId[] = [];
  private since = Date.now();

  constructor(players: PlayerId[], poolMs: number) {
    this.pools = Object.fromEntries(players.map((p) => [p, poolMs]));
  }

  activate(players: PlayerId[]): void {
    this.active = players;
    this.since = Date.now();
  }

  charge(): void {
    const now = Date.now();
    const elapsed = now - this.since;
    this.since = now;
    for (const p of this.active) {
      this.pools[p] = Math.max(0, this.pools[p] - elapsed);
    }
  }

  remainingMs(): number {
    return Math.min(...this.active.map((p) => this.pools[p]));
  }

  isExpired(): boolean {
    return this.active.some((p) => this.pools[p] <= 0);
  }

  zeroLowest(): void {
    const lowest = this.remainingMs();
    for (const p of this.active) {
      if (this.pools[p] === lowest) this.pools[p] = 0;
    }
  }

  toEvent(): ClockEvent {
    return { clocks: { ...this.pools }, active: [...this.active] };
  }
}
