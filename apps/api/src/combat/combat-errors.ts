import { redisLockErrorResponse } from '@server/lib/http/errors';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { InventoryError } from '@server/lib/services/InventoryService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { BeastError } from '@server/lib/services/combat-v6/CombatV6BeastService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import { CombatV6TrainingSessionError } from '@server/lib/services/combat-v6/CombatV6TrainingSessionService';
import { WildError } from '@server/lib/services/combat-v6/CombatV6WildSessionService';
import { TrainingHostError } from '@daoyou/shared/engine/combat-v6/encounter';
import { InventoryRuleError } from '@daoyou/shared/inventory';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter';

export function combatErrorResponse(error: unknown): Response {
  if (error instanceof QiInsufficientError)
    return Response.json(
      {
        success: false,
        code: error.code,
        error: '天地灵气不足，待自然恢复或使用恢复符箓后再试。',
      },
      { status: 409 },
    );
  if (
    error instanceof QiServiceError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  if (error instanceof InventoryError || error instanceof InventoryRuleError)
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  if (error instanceof BeastError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  const coordination = redisLockErrorResponse(error);
  if (coordination) return coordination;
  if (error instanceof TrainingHostError)
    return Response.json(
      {
        success: false,
        code: 'WILD_COMMAND_NOT_ALLOWED',
        error: error.message,
      },
      { status: 400 },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        success: false,
        code: 'INVALID_REQUEST',
        error: error.issues[0]?.message ?? '参数错误',
        details: error.issues,
      },
      { status: 400 },
    );
  if (
    error instanceof CombatV6BuildError ||
    error instanceof WildError ||
    error instanceof CombatV6TrainingSessionError
  )
    return Response.json(
      { success: false, code: error.code, error: error.message },
      { status: error.status },
    );
  console.error('combat-v6 api error:', error);
  return Response.json(
    {
      success: false,
      code: 'COMBAT_V6_INTERNAL_ERROR',
      error: '练功房暂不可用，请稍后再试',
    },
    { status: 500 },
  );
}

export const CombatErrors = apiErrorFilter(combatErrorResponse);
