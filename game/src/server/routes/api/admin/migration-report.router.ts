import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getAppSetting } from '@server/lib/repositories/appSettingsRepository';
import { Hono } from 'hono';
import { z } from 'zod';

const retirementSchema = z.object({
  table: z.enum([
    'wanjiedaoyou_reputation_shop_items',
    'wanjiedaoyou_sect_shop_items',
  ]),
  shopId: z.string().min(1).max(100),
  itemId: z.string().min(1).max(200),
  scenario: z.enum(['draw_gongfa', 'draw_skill']),
  reason: z.string().min(1).max(2000),
});
const reportSchema = z.object({
  retired: z.array(retirementSchema).max(10000),
});
const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  c.header('Cache-Control', 'private, no-store');
  const raw = await getAppSetting('custom-v0415:library-snapshots');
  if (!raw) return c.json({ retired: [] });
  try {
    // Return only the retirement explanation, never the preserved item snapshots.
    const report = reportSchema.safeParse(JSON.parse(raw));
    if (!report.success) {
      return c.json({ error: '迁移记录格式异常，请核对升级报告。' }, 500);
    }
    return c.json({ retired: report.data.retired });
  } catch {
    return c.json({ error: '迁移记录格式异常，请核对升级报告。' }, 500);
  }
});

export default router;
