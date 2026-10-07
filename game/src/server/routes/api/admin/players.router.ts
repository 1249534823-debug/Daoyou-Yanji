import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { searchAdminPlayers } from '@server/lib/repositories/adminPlayerSearchRepository';
import { AdminPlayerSearchQuerySchema } from '@shared/contracts/adminPlayers';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
router.get('/', async (c) => {
  const parsed = AdminPlayerSearchQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: '搜索条件无效，请输入 1 至 100 个字符的玩家名称',
      },
      400,
    );
  }
  const { q } = parsed.data;
  try {
    return c.json({
      success: true,
      data: { players: await searchAdminPlayers(q) },
    });
  } catch (error) {
    console.error('[admin-player-search] request failed', error);
    return c.json({ success: false, error: '玩家搜索失败，请稍后重试' }, 500);
  }
});
export default router;
