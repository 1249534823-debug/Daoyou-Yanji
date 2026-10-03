import { Controller, Get, Header, Inject, UseFilters } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { PlayerJournalQuerySchema } from '@daoyou/shared/contracts/playerJournal';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { FirstQuery } from '../http/first-query';
import { ZodPipe } from '../http/zod.pipe';
import { PlayerService } from './player.service';

const JournalErrors = apiErrorFilter((error) => {
  if (error instanceof z.ZodError)
    return Response.json({ error: '日志查询参数无效' }, { status: 400 });
  console.error('修仙日志查询失败:', error);
  return Response.json({ error: '修仙日志暂时无法读取' }, { status: 500 });
});

@Controller('api/player-journal')
@Access('active')
@UseFilters(JournalErrors)
export class JournalController {
  constructor(@Inject(PlayerService) private readonly player: PlayerService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(PlayerJournalQuerySchema))
    query: z.infer<typeof PlayerJournalQuerySchema>,
  ) {
    return this.player.journal(actor.cultivatorId, query);
  }
}
