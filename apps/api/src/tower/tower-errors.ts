import { redisLockErrorResponse } from '@server/lib/http/errors';
import { InventoryError } from '@server/lib/services/InventoryService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import { TowerV6Error } from '@server/lib/tower/combatV6';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter';

function towerError(error: unknown): Response {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof ZodError)
    return Response.json({ error: '幻境请求参数无效' }, { status: 400 });
  if (
    error instanceof TowerV6Error ||
    error instanceof InventoryError ||
    error instanceof CombatV6BuildError
  )
    return Response.json({ error: error.message }, { status: 409 });
  console.error('[tower-v6] request failed', error);
  return Response.json(
    { error: '幻境操作失败，请刷新后重试' },
    { status: 500 },
  );
}

export const TowerErrors = apiErrorFilter(towerError);
