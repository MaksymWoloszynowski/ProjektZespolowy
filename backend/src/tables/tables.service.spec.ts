import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEngine } from '../engines/engine.js';
import { TablesService, tableRoom, userRoom } from './tables.service.js';

// race to 3: each action adds 1 to the player's score, first to 3 wins
type State = Record<string, number>;
const raceEngine: GameEngine<State, 'inc', State> = {
  id: 'race',
  name: 'Race',
  usesElo: false,
  minPlayers: 2,
  maxPlayers: 3,
  createInitialState: (players) =>
    Object.fromEntries(players.map((p) => [p, 0])),
  getActivePlayers: (s) => Object.keys(s),
  applyAction: (s, p, a) =>
    a === 'inc'
      ? { ok: true, state: { ...s, [p]: s[p] + 1 } }
      : { ok: false, reason: 'bad action' },
  onTurnTimeout: (s) => s,
  // each player sees only their own score
  getPlayerView: (s, p) => ({ [p]: s[p] }),
  getResult: (s) => {
    const winner = Object.keys(s).find((p) => s[p] >= 3);
    if (!winner) return null;
    return Object.fromEntries(
      Object.keys(s).map((p) => [p, p === winner ? 'win' : 'loss']),
    ) as never;
  },
};

// two players take turns, whoever runs out of time loses
type TurnState = { players: string[]; turn: number; lost?: string };
const turnEngine: GameEngine<TurnState, 'move', TurnState> = {
  id: 'turns',
  name: 'Turns',
  usesElo: false,
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState: (players) => ({ players, turn: 0 }),
  getActivePlayers: (s) => (s.lost ? [] : [s.players[s.turn]]),
  applyAction: (s, p, a) =>
    a !== 'move'
      ? { ok: false, reason: 'bad action' }
      : s.players[s.turn] !== p
        ? { ok: false, reason: 'not your turn' }
        : { ok: true, state: { ...s, turn: 1 - s.turn } },
  onTurnTimeout: (s) => ({ ...s, lost: s.players[s.turn] }),
  getPlayerView: (s) => s,
  getResult: (s) =>
    s.lost
      ? Object.fromEntries(
          s.players.map((p) => [p, p === s.lost ? 'loss' : 'win']),
        )
      : (null as never),
};

const settings = { maxPlayers: 2, private: false, timeSeconds: 600 };

describe('TablesService', () => {
  let tables: TablesService;
  const hub = { join: vi.fn(), leave: vi.fn(), emit: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    tables = new TablesService();
    tables.hub = hub;
    tables.getEngine = (id) => ({ race: raceEngine, turns: turnEngine })[id];
  });

  const tableId = () =>
    hub.emit.mock.calls.find((c) => c[1] === 'table:state')![2].id as string;

  it('rejects unknown games and bad player limits', () => {
    expect(tables.create('a', 'nope', settings).ok).toBe(false);
    expect(tables.create('a', 'race', { ...settings, maxPlayers: 9 }).ok).toBe(
      false,
    );
  });

  it('allows one table per player and respects the player limit', () => {
    tables.create('a', 'race', settings);
    const id = tableId();
    expect(tables.create('a', 'race', settings).ok).toBe(false);
    expect(tables.join('b', id).ok).toBe(true);
    expect(tables.join('c', id).ok).toBe(false);
  });

  it('passes the host on and drops the empty table', () => {
    tables.create('a', 'race', settings);
    const id = tableId();
    tables.join('b', id);
    tables.leave('a');
    expect(hub.emit).toHaveBeenLastCalledWith(
      tableRoom(id),
      'table:state',
      expect.objectContaining({ hostId: 'b' }),
    );
    tables.leave('b');
    expect(tables.join('c', id).ok).toBe(false);
  });

  it('only the host starts, and only with enough players', () => {
    tables.create('a', 'race', settings);
    const id = tableId();
    expect(tables.start('a').ok).toBe(false);
    tables.join('b', id);
    expect(tables.start('b').ok).toBe(false);
    expect(tables.start('a').ok).toBe(true);
  });

  it('sends each player their own view and ends the game on a result', () => {
    tables.create('a', 'race', settings);
    tables.join('b', tableId());
    tables.start('a');
    expect(hub.emit).toHaveBeenCalledWith(userRoom('a'), 'game:state', {
      view: { a: 0 },
    });
    expect(hub.emit).toHaveBeenCalledWith(userRoom('b'), 'game:state', {
      view: { b: 0 },
    });
    expect(tables.action('a', 'bad').ok).toBe(false);
    for (let i = 0; i < 3; i++) tables.action('a', 'inc');
    expect(hub.emit).toHaveBeenCalledWith(expect.any(String), 'game:over', {
      result: { a: 'win', b: 'loss' },
    });
    // back in the lobby, so the host can start a rematch
    expect(tables.start('a').ok).toBe(true);
  });

  it('dissolves the table when a player leaves mid-game', () => {
    tables.create('a', 'race', settings);
    tables.join('b', tableId());
    tables.start('a');
    tables.leave('b');
    expect(hub.emit).toHaveBeenCalledWith(
      expect.any(String),
      'table:closed',
      expect.anything(),
    );
    expect(tables.action('a', 'inc').ok).toBe(false);
  });

  it('fires the timeout once when a pool runs out', () => {
    vi.useFakeTimers();
    const onTurnTimeout = vi.spyOn(raceEngine, 'onTurnTimeout');
    tables.create('a', 'race', { ...settings, timeSeconds: 60 });
    tables.join('b', tableId());
    tables.start('a');
    // the race engine ignores timeouts, so this also checks that we do not spin
    vi.advanceTimersByTime(120_000);
    expect(onTurnTimeout).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('rejects a missing or out-of-range time limit', () => {
    for (const timeSeconds of [undefined, 0, 59, 3601, 1.5, NaN, '60']) {
      const bad = { ...settings, timeSeconds } as never;
      expect(tables.create('a', 'race', bad).ok).toBe(false);
    }
    expect(
      tables.create('a', 'race', { ...settings, timeSeconds: 60 }).ok,
    ).toBe(true);
  });

  it('answers a malformed action instead of throwing', () => {
    tables.create('a', 'race', settings);
    tables.join('b', tableId());
    tables.start('a');
    vi.spyOn(raceEngine, 'applyAction').mockImplementationOnce(() => {
      throw new TypeError('malformed');
    });
    expect(tables.action('a', null)).toEqual({
      ok: false,
      reason: 'invalid action',
    });
  });

  describe('player clocks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const startTurns = () => {
      tables.create('a', 'turns', { ...settings, timeSeconds: 60 });
      tables.join('b', tableId());
      tables.start('a');
    };

    const lastClock = () =>
      hub.emit.mock.calls.filter((c) => c[1] === 'game:clock').at(-1)![2];

    it('spends a pool only on its owner turn and carries it over', () => {
      startTurns();
      vi.advanceTimersByTime(40_000); // a thinks for 40 s
      expect(tables.action('a', 'move').ok).toBe(true);
      expect(lastClock()).toEqual({
        clocks: { a: 20_000, b: 60_000 },
        active: ['b'],
      });

      vi.advanceTimersByTime(50_000); // b thinks for 50 s
      expect(tables.action('b', 'move').ok).toBe(true);
      expect(lastClock()).toEqual({
        clocks: { a: 20_000, b: 10_000 },
        active: ['a'],
      });

      vi.advanceTimersByTime(19_999);
      expect(hub.emit).not.toHaveBeenCalledWith(
        expect.any(String),
        'game:over',
        expect.anything(),
      );
      vi.advanceTimersByTime(1);
      expect(hub.emit).toHaveBeenCalledWith(expect.any(String), 'game:over', {
        result: { a: 'loss', b: 'win' },
      });
    });

    it('rejects a move that arrives after the pool ran out', () => {
      startTurns();
      // the clock jumps without firing the timer, like a late message
      vi.setSystemTime(Date.now() + 61_000);
      expect(tables.action('a', 'move')).toEqual({
        ok: false,
        reason: 'time is up',
      });
      expect(hub.emit).toHaveBeenCalledWith(expect.any(String), 'game:over', {
        result: { a: 'loss', b: 'win' },
      });
    });

    it('keeps the clock running through a bad action', () => {
      startTurns();
      vi.advanceTimersByTime(10_000);
      expect(tables.action('a', 'nope').ok).toBe(false);
      vi.advanceTimersByTime(10_000);
      expect(tables.action('a', 'move').ok).toBe(true);
      expect(lastClock().clocks.a).toBe(40_000);
    });

    it('resends the clocks to a player who comes back', () => {
      startTurns();
      tables.disconnect('b');
      vi.advanceTimersByTime(5_000);
      hub.emit.mockClear();
      tables.reconnect('b');
      expect(hub.emit).toHaveBeenCalledWith(userRoom('b'), 'game:clock', {
        clocks: { a: 55_000, b: 60_000 },
        active: ['a'],
      });
    });
  });

  describe('disconnect grace period', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      tables.graceMs = 1000;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const startGame = () => {
      tables.create('a', 'race', settings);
      tables.join('b', tableId());
      tables.start('a');
      hub.emit.mockClear();
    };

    it('keeps the seat and resends the state on reconnect', () => {
      startGame();
      tables.disconnect('b');
      vi.advanceTimersByTime(500);
      hub.join.mockClear();
      tables.reconnect('b');
      vi.advanceTimersByTime(5000);

      // the new socket has to get the table room broadcasts again
      expect(hub.join).toHaveBeenCalledWith('b', tableRoom(tableId()));
      expect(hub.emit).toHaveBeenCalledWith(
        userRoom('b'),
        'table:state',
        expect.objectContaining({ status: 'playing' }),
      );
      expect(hub.emit).toHaveBeenCalledWith(userRoom('b'), 'game:state', {
        view: { b: 0 },
      });
      expect(tables.action('b', 'inc').ok).toBe(true);
    });

    it('drops the player and closes a running game after the grace period', () => {
      startGame();
      tables.disconnect('b');
      vi.advanceTimersByTime(1000);

      expect(hub.emit).toHaveBeenCalledWith(
        expect.any(String),
        'table:closed',
        expect.anything(),
      );
      expect(tables.action('a', 'inc').ok).toBe(false);
    });

    it('ignores a disconnect from a player without a table', () => {
      tables.disconnect('x');
      vi.advanceTimersByTime(1000);
      expect(hub.emit).not.toHaveBeenCalled();
    });
  });

  it('lists only public tables of that game that are still in the lobby', () => {
    tables.create('a', 'race', settings);
    tables.create('b', 'race', { ...settings, private: true });
    tables.create('c', 'race', settings);
    const lastTableId = hub.emit.mock.calls
      .filter((c) => c[1] === 'table:state')
      .at(-1)![2].id as string;
    tables.join('d', lastTableId);
    tables.start('c');
    const listed = tables.getTables('race');
    expect(listed.map((t) => t.hostId)).toEqual(['a']);
    expect(tables.getTables('other')).toEqual([]);
  });

  it('announces players joining and leaving in the table chat', () => {
    tables.create('a', 'race', settings);
    const id = tableId();
    tables.join('b', id);
    expect(hub.emit).toHaveBeenCalledWith(tableRoom(id), 'chat:message', {
      from: 'b',
      event: 'joined',
    });
    tables.leave('b');
    expect(hub.emit).toHaveBeenCalledWith(tableRoom(id), 'chat:message', {
      from: 'b',
      event: 'left',
    });
  });

  it('chat only reaches seated players and rejects empty text', () => {
    expect(tables.chat('a', 'hi').ok).toBe(false);
    tables.create('a', 'race', settings);
    expect(tables.chat('a', '   ').ok).toBe(false);
    expect(tables.chat('a', ' hi ').ok).toBe(true);
    expect(hub.emit).toHaveBeenCalledWith(expect.any(String), 'chat:message', {
      from: 'a',
      text: 'hi',
    });
  });
});
