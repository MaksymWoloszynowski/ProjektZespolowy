import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClock } from './game-clock.js';

describe('GameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only runs for the players on turn', () => {
    const clock = new GameClock(['a', 'b'], 60_000);
    clock.activate(['a']);
    vi.advanceTimersByTime(10_000);
    clock.charge();

    expect(clock.toEvent()).toEqual({
      clocks: { a: 50_000, b: 60_000 },
      active: ['a'],
    });
    expect(clock.remainingMs()).toBe(50_000);
  });

  it('does not charge twice for the same time', () => {
    const clock = new GameClock(['a', 'b'], 60_000);
    clock.activate(['a']);
    vi.advanceTimersByTime(5_000);
    clock.charge();
    clock.charge();

    expect(clock.remainingMs()).toBe(55_000);
  });

  it('keeps what is left when the turn passes on and back', () => {
    const clock = new GameClock(['a', 'b'], 60_000);
    clock.activate(['a']);
    vi.advanceTimersByTime(40_000);
    clock.charge();
    clock.activate(['b']);
    vi.advanceTimersByTime(50_000);
    clock.charge();
    clock.activate(['a']);

    expect(clock.remainingMs()).toBe(20_000);
  });

  it('is expired once a pool on turn is empty and zeroLowest settles it', () => {
    const clock = new GameClock(['a', 'b'], 60_000);
    clock.activate(['a']);
    vi.advanceTimersByTime(60_000);
    clock.charge();

    expect(clock.isExpired()).toBe(true);
    clock.zeroLowest();
    expect(clock.toEvent().clocks.a).toBe(0);
  });

  it('has nothing to count down when nobody is on turn', () => {
    const clock = new GameClock(['a', 'b'], 60_000);
    clock.activate([]);

    expect(clock.isExpired()).toBe(false);
    expect(clock.remainingMs()).toBe(Infinity);
  });
});
