import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { redisLockErrorResponse } from '@server/lib/http/errors';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { ReputationShopError } from '@server/lib/services/ReputationShopService';
import {
  ReputationShopBuyBodySchema,
  ReputationShopBuyParamsSchema,
} from '@daoyou/shared/contracts/reputationShop';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { JsonBody } from '../http/json-body';
import { ZodPipe } from '../http/zod.pipe';
import { ReputationShopService } from './reputation-shop.service';

const ReputationBuyErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error instanceof ReputationShopError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: '参数错误', details: error.flatten() },
      { status: 400 },
    );
  console.error('reputation shop buy error:', error);
  return Response.json({ error: '兑换失败，请稍后再试' }, { status: 500 });
});

@Controller('api/reputation-shop')
@Access('active')
export class ReputationShopController {
  constructor(
    @Inject(ReputationShopService) private readonly shop: ReputationShopService,
  ) {}

  @Get()
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.shop.list(actor.cultivatorId);
  }

  @Post(':id/buy')
  @HttpCode(200)
  @UseFilters(ReputationBuyErrors)
  buy(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(ReputationShopBuyParamsSchema))
    params: z.infer<typeof ReputationShopBuyParamsSchema>,
    @JsonBody(new ZodPipe(ReputationShopBuyBodySchema))
    input: z.infer<typeof ReputationShopBuyBodySchema>,
  ) {
    return this.shop.buy(actor, params.id, input.requestId);
  }
}
