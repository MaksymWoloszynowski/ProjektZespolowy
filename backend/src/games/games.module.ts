import { Module } from '@nestjs/common';
import { GamesService } from './games.service.js';
import { GamesController } from './games.controller.js';

@Module({
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
