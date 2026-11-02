import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule } from '@nestjs/config';
import { DATABASE_CONNECTION, DatabaseModule } from './db/db.module.js';
import type { Database } from './db/db.module.js';
import { createAuth } from './auth/auth.js';
import { AppGateway } from './ws/app.gateway.js';
import { TablesModule } from './tables/tables.module.js';
import { GamesModule } from './games/games.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),
    DatabaseModule,
    TablesModule,
    GamesModule,
    AuthModule.forRootAsync({
      inject: [DATABASE_CONNECTION],
      useFactory: (db: Database) => ({ auth: createAuth(db) }),
    }),
  ],
  providers: [AppGateway],
})
export class AppModule {}
