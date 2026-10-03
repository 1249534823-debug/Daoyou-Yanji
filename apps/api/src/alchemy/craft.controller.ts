import {
  All,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { redisLockErrorResponse } from '@server/lib/http/errors';
import { AlchemyServiceError } from '@server/alchemy/application/AlchemyServiceError';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { CraftCommandError } from '@server/forging/application/CraftApplicationService';
import { QiServiceError } from '@server/cultivator/application/QiService';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { CraftCommandSchema, CraftSchema } from './alchemy-input';
import { CraftService } from './craft.service';

const retired = new Set(['refine', 'create_skill', 'create_gongfa']);
const retiredMessage = '旧功法、神通及装备生产已停用，历史物品保留在洞府宝库';
const CraftErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return Response.json(
      { success: false, error: '请求参数无效' },
      { status: 400 },
    );
  if (
    error instanceof AlchemyServiceError ||
    error instanceof CraftCommandError ||
    error instanceof PlayerCommandIdempotencyError ||
    error instanceof QiServiceError
  )
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  console.error('[alchemy] request failed', error);
  return Response.json(
    { success: false, error: '炼丹请求失败，请重新核对材料' },
    { status: 500 },
  );
});

@Controller('api/craft')
@Access('active')
@UseFilters(CraftErrors)
export class CraftController {
  constructor(@Inject(CraftService) private readonly craft: CraftService) {}

  @Get()
  preview(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    if (query.craftType && retired.has(query.craftType))
      throw new HttpException({ error: retiredMessage }, 410);
    const input = CraftSchema.parse({
      craftType: query.craftType,
      alchemyMode: query.alchemyMode,
      materialIds: (query.materialIds ?? '').split(','),
      materialQuantities: query.materialQuantities
        ? JSON.parse(query.materialQuantities)
        : undefined,
      formulaId: query.formulaId,
      materialVersions: query.materialVersions
        ? JSON.parse(query.materialVersions)
        : {},
    });
    return this.craft.preview(actor, input);
  }

  @Post()
  @HttpCode(200)
  execute(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() body: unknown,
  ) {
    if (
      body &&
      typeof body === 'object' &&
      'craftType' in body &&
      typeof body.craftType === 'string' &&
      retired.has(body.craftType)
    )
      throw new HttpException({ error: retiredMessage }, 410);
    return this.craft.execute(actor, CraftCommandSchema.parse(body));
  }

  @All('pending')
  @HttpCode(410)
  pending() {
    return { error: retiredMessage };
  }

  @All('confirm')
  @HttpCode(410)
  confirm() {
    return { error: retiredMessage };
  }
}
