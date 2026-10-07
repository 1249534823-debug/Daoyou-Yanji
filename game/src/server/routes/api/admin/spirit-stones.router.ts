import {
  getValidatedQuery,
  requireAdmin,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getSpiritStoneDaily,
  getSpiritStoneLedger,
} from '@server/lib/services/SpiritStoneStatisticsService';
import {
  SpiritStoneDailyQuerySchema,
  SpiritStoneLedgerQuerySchema,
  type SpiritStoneDailyQuery,
  type SpiritStoneLedgerQuery,
} from '@shared/contracts/spiritStoneStatistics';
import { Hono } from 'hono';
import { ZodError } from 'zod';
const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
router.onError((error, c) => {
  if (error instanceof ZodError)
    return c.json(
      { success: false, error: error.issues[0]?.message || '查询参数无效' },
      400,
    );
  console.error('[spirit-stone-statistics]', error);
  return c.json({ success: false, error: '灵石统计读取失败，请稍后重试' }, 500);
});
router.get('/daily', validateQuery(SpiritStoneDailyQuerySchema), async (c) =>
  c.json({
    success: true,
    data: await getSpiritStoneDaily(
      getValidatedQuery<SpiritStoneDailyQuery>(c),
    ),
  }),
);
router.get('/ledger', validateQuery(SpiritStoneLedgerQuerySchema), async (c) =>
  c.json({
    success: true,
    data: await getSpiritStoneLedger(
      getValidatedQuery<SpiritStoneLedgerQuery>(c),
    ),
  }),
);
export default router;
