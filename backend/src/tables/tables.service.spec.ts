import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const settings = { maxPlayers: 2, private: false };

describe('TablesService', () => {
  let tables: TablesService;
  const hub = { join: vi.fn(), leave: vi.fn(), emit: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    tables = new TablesService();
    tables.hub = hub;
    tables.getEngine = (id) => (id === 'race' ? raceEngine : undefined);
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

  it('fires the turn timeout', () => {
    vi.useFakeTimers();
    const onTurnTimeout = vi.spyOn(raceEngine, 'onTurnTimeout');
    tables.create('a', 'race', { ...settings, turnSeconds: 5 });
    tables.join('b', tableId());
    tables.start('a');
    vi.advanceTimersByTime(5000);
    expect(onTurnTimeout).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
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
