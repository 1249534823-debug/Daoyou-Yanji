import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  getTempCharacter,
  getTempRerollsRemaining,
  saveTempFates,
} from '@server/lib/repositories/redisCultivatorRepository';
import { FATE_REROLL_LIMIT } from '@server/lib/services/FateConfig';
import { FateEngine } from '@server/lib/services/FateEngine';
import { Hono } from 'hono';
import { z } from 'zod';

const GenerateFatesSchema = z.object({ tempId: z.string().uuid() });
const router = new Hono<AppEnv>();
router.post('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: '未授权访问' }, 401);
  const { tempId } = GenerateFatesSchema.parse(await c.req.json());
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorCreation(user.id),
      context: 'generate-fates',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) => {
      if (!(await getTempCharacter(tempId, user.id))) {
        return c.json(
          { success: false, error: '角色推演已过期，请重新生成。' },
          404,
        );
      }
      if (
        (await getTempRerollsRemaining(tempId, user.id, FATE_REROLL_LIMIT)) ===
        0
      )
        return c.json(
          {
            success: false,
            error: `逆天改命次数已尽（最多 ${FATE_REROLL_LIMIT} 次）`,
          },
          400,
        );
      const fates = await FateEngine.generateCandidatePool();
      lease.assertHeld();
      const saved = await saveTempFates(
        tempId,
        user.id,
        fates,
        FATE_REROLL_LIMIT,
      );
      if (saved.expired)
        return c.json(
          { success: false, error: '角色推演已过期，请重新生成。' },
          404,
        );
      if (!saved.allowed)
        return c.json(
          {
            success: false,
            error: `逆天改命次数已尽（最多 ${FATE_REROLL_LIMIT} 次）`,
          },
          400,
        );
      return c.json({
        success: true,
        data: { fates, remainingRerolls: saved.remaining },
      });
    },
  );
});
export default router;
