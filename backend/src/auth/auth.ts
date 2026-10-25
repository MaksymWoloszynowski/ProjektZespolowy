import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Database } from '../db/db.module.js';

export const createAuth = (database: Database) =>
  betterAuth({
    database: drizzleAdapter(database, { provider: 'pg' }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [process.env.FRONTEND_URL ?? 'https://localhost:5173'],
  });

export type Auth = ReturnType<typeof createAuth>;
