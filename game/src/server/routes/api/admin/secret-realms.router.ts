import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  listSecretRealms,
  SecretRealmError,
  toggleSecretRealm,
} from '@server/lib/services/SecretRealmService';
import {
  SecretRealmParamsSchema,
  SecretRealmToggleSchema,
} from '@shared/contracts/secretRealms';
import { Hono } from 'hono';
import { ZodError } from 'zod';
const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
router.get('/', async (c) => c.json(await listSecretRealms()));
router.patch('/:id', async (c) => {
  try {
    const { id } = SecretRealmParamsSchema.parse(c.req.param());
    const { enabled, version, rewards } = SecretRealmToggleSchema.parse(
      await c.req.json(),
    );
    return c.json(
      await toggleSecretRealm(id, enabled, version, c.get('user')!.id, rewards),
    );
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError)
      return c.json({ error: '请求参数格式错误' }, 400);
    if (error instanceof SecretRealmError)
      return c.json({ error: error.message }, error.status);
    throw error;
  }
});
export default router;
