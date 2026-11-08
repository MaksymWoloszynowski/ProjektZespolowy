import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../db/db.module.js';
import { allEngines } from '../engines/registry.js';
import { GamesService } from './games.service.js';

// the real registry holds the shipped engines, here we control what it returns
vi.mock('../engines/registry.js', () => ({ allEngines: vi.fn() }));

describe('GamesService', () => {
  beforeEach(() => {
    vi.mocked(allEngines).mockReset();
  });

  it('skips the upsert when there are no engines', async () => {
    vi.mocked(allEngines).mockReturnValue([]);
    const insert = vi.fn();
    const service = new GamesService({ insert } as unknown as Database);
    await service.onModuleInit();
    expect(insert).not.toHaveBeenCalled();
  });

  it('upserts every registered engine as a game row', async () => {
    vi.mocked(allEngines).mockReturnValue([
      {
        id: 'checkers',
        name: 'Checkers',
        usesElo: true,
        minPlayers: 2,
        maxPlayers: 2,
      } as never,
    ]);
    const onConflictDoUpdate = vi.fn();
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const service = new GamesService({ insert } as unknown as Database);

    await service.onModuleInit();

    expect(values).toHaveBeenCalledWith([
      {
        id: 'checkers',
        name: 'Checkers',
        minPlayers: 2,
        maxPlayers: 2,
        usesElo: true,
      },
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});
