import { Controller, Get, Param } from '@nestjs/common';
import { TablesService } from './tables.service.js';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}
  @Get(':gameId')
  getTables(@Param('gameId') gameId: string) {
    return this.tablesService.getTables(gameId);
  }
}
