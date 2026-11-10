import { pgTable, text, boolean, integer } from 'drizzle-orm/pg-core';

export const game = pgTable('game', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  minPlayers: integer('min_players').notNull(),
  maxPlayers: integer('max_players').notNull(),
  usesElo: boolean('uses_elo').default(false).notNull(),
});
