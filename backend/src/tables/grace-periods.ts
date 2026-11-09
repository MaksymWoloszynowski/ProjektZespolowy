import type { PlayerId } from '../engines/engine.js';

export class GracePeriods {
  private readonly timers = new Map<PlayerId, NodeJS.Timeout>();

  start(userId: PlayerId, ms: number, onExpire: () => void): void {
    this.cancel(userId);
    this.timers.set(
      userId,
      setTimeout(() => {
        this.timers.delete(userId);
        onExpire();
      }, ms),
    );
  }

  cancel(userId: PlayerId): void {
    clearTimeout(this.timers.get(userId));
    this.timers.delete(userId);
  }
}
