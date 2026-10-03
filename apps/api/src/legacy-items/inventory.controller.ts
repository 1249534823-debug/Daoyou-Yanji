import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { redisLockErrorResponse } from '@server/lib/http/errors';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { LegacyInventoryService } from './inventory.service';

const LegacyInventoryErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('Legacy inventory API error:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

@Controller('api/cultivator/inventory')
@Access('active')
@UseFilters(LegacyInventoryErrors)
export class LegacyInventoryController {
  constructor(
    @Inject(LegacyInventoryService)
    private readonly inventory: LegacyInventoryService,
  ) {}

  @Get()
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    return this.inventory.list(actor, query);
  }

  @Post('discard')
  @HttpCode(200)
  discard(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() body: unknown,
  ) {
    return this.inventory.discard(actor, body);
  }

  @Post('identify')
  @HttpCode(410)
  identify() {
    return { error: '未鉴定材料已弃用，无法鉴定或迁移' };
  }
}
