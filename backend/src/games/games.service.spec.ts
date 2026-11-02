import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../db/db.module.js';
import { GamesService } from './games.service.js';

describe('GamesService', () => {
  it('skips the upsert when there are no engines', async () => {
    const insert = vi.fn();
    const service = new GamesService({ insert } as unknown as Database);
    await service.onModuleInit();
    expect(insert).not.toHaveBeenCalled();
  });
});
