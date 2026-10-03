import { redisLockErrorResponse } from '@server/lib/http/errors';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { InventoryError } from '@server/inventory/application/InventoryService';
import { SectError } from '@server/sects/application/SectError';
import { SectShopError } from '@server/sects/application/SectShopService';
import { apiErrorFilter } from '../http/error-filter';

export const SectErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof PlayerCommandIdempotencyError)
    return Response.json(
      { success: false, error: error.message, code: error.code },
      { status: 409 },
    );
  if (error instanceof SectError)
    return Response.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof SectShopError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  if (error instanceof InventoryError)
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  console.error('[sects]', error);
  return Response.json(
    { success: false, error: '宗门事务处理失败' },
    { status: 500 },
  );
});
