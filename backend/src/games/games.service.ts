import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../db/db.module.js';
import type { Database } from '../db/db.module.js';
import { game } from '../db/schema/index.js';
import { allEngines } from '../engines/registry.js';

@Injectable()
export class GamesService implements OnModuleInit {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async onModuleInit(): Promise<void> {
    const rows = allEngines().map((e) => ({
      id: e.id,
      name: e.name,
      minPlayers: e.minPlayers,
      maxPlayers: e.maxPlayers,
      usesElo: e.usesElo,
    }));

    if (rows.length === 0) return;
    await this.db
      .insert(game)
      .values(rows)
      .onConflictDoUpdate({
        target: game.id,
        set: {
          name: sql`excluded.name`,
          minPlayers: sql`excluded.min_players`,
          maxPlayers: sql`excluded.max_players`,
          usesElo: sql`excluded.uses_elo`,
        },
      });
  }

  getGames() {
    return this.db.select().from(game);
  }
}
