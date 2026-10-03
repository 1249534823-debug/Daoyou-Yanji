import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { redisLockErrorResponse } from '@server/lib/http/errors';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { InventoryError } from '@server/lib/services/InventoryService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import {
  InscriptionRequestSchema,
  type InscriptionRequest,
} from '@daoyou/shared/contracts/inscriptions';
import { InventoryRuleError } from '@daoyou/shared/inventory';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { JsonBody } from '../http/json-body';
import { ZodPipe } from '../http/zod.pipe';
import { InscriptionsService } from './inscriptions.service';

const InscriptionsErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, code: 'INSCRIPTION_REJECTED', error: '阵纹参数无效' },
      { status: 400 },
    );
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError ||
    error instanceof QiInsufficientError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json(
      { success: false, code: 'INSCRIPTION_REJECTED', error: error.message },
      { status: 409 },
    );
  console.error('[inscriptions] request failed', error);
  return Response.json(
    { success: false, error: '本次结果暂未确认，请重试核对' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/inscriptions')
@Access('active')
@UseFilters(InscriptionsErrors)
export class InscriptionsController {
  constructor(
    @Inject(InscriptionsService) private readonly service: InscriptionsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.service.read(actor);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  mutate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(InscriptionRequestSchema))
    input: InscriptionRequest,
  ) {
    return this.service.mutate(actor, input);
  }
}
