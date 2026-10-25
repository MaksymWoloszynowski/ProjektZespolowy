import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule } from '@nestjs/config';
import { DATABASE_CONNECTION, DatabaseModule } from './db/db.module.js';
import type { Database } from './db/db.module.js';
import { createAuth } from './auth/auth.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),
    DatabaseModule,
    AuthModule.forRootAsync({
      inject: [DATABASE_CONNECTION],
      useFactory: (db: Database) => ({ auth: createAuth(db) }),
    }),
  ],
})
export class AppModule {}
