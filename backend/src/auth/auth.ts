import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { anonymous } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Database } from '../db/db.module.js';

export const createAuth = (database: Database) =>
  betterAuth({
    database: drizzleAdapter(database, { provider: 'pg' }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [process.env.FRONTEND_URL ?? 'https://localhost:5173'],
    rateLimit: {
      customRules: { '/sign-in/anonymous': { window: 3600, max: 20 } },
    },
    plugins: [
      anonymous({
        generateName: () => `Guest-${randomUUID().slice(0, 6)}`,
        disableDeleteAnonymousUser: true,
      }),
    ],
  });

export type Auth = ReturnType<typeof createAuth>;
