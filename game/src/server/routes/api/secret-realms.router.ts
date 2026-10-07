import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { listSecretRealms } from '@server/lib/services/SecretRealmService';
import { Hono } from 'hono';
const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.get('/', async (c) => c.json(await listSecretRealms(c.get('activeCultivatorRef')!.cultivatorId)));
router.post('/:id/:action', (c) => c.json({ error: '请从副本入口挑战；击败全部守卫与首领后自动结算奖励。' }, 409));
export default router;
