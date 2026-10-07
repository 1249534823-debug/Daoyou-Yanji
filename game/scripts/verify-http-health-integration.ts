/** Run ONLY in the disposable admin-test network; no production data. */
import { Hono } from 'hono';
import assert from 'node:assert/strict';
const dbUrl = new URL(process.env.DATABASE_URL!);
const redisUrl = new URL(process.env.REDIS_URL!);
assert.equal(dbUrl.hostname, 'admin-test-db');
assert.equal(dbUrl.pathname, '/admin_ui_test');
assert.equal(redisUrl.hostname, 'admin-test-redis');
const mode = process.argv[2] ?? 'healthy';
let checks = 0;
function equal(actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected);
  checks++;
}
if (mode === 'database-down') {
  process.env.DATABASE_URL =
    'postgres://invalid:invalid@127.0.0.1:1/admin_ui_test';
} else if (mode === 'redis-down') {
  process.env.REDIS_URL = 'redis://127.0.0.1:1/15';
}
const { getDatabaseHealthStatus, db } =
  await import('../src/server/lib/drizzle/db');
if (mode === 'database-down') {
  const start = Date.now();
  equal(
    await Promise.all(
      Array.from({ length: 40 }, () => getDatabaseHealthStatus()),
    ),
    Array(40).fill('down'),
  );
  assert.ok(Date.now() - start < 2200);
  checks++;
} else if (mode === 'healthy') {
  equal(await getDatabaseHealthStatus(), 'up');
  // Occupy every application pool connection, without any SQL mutations.
  const clients = await Promise.all(
    Array.from({ length: Number(process.env.DB_MAX_CONNECTIONS || 20) }, () =>
      db.$client.connect(),
    ),
  );
  await Bun.sleep(550);
  const start = Date.now();
  equal(
    await Promise.all(
      Array.from({ length: 40 }, () => getDatabaseHealthStatus()),
    ),
    Array(40).fill('down'),
  );
  assert.ok(Date.now() - start < 2200);
  checks++;
  equal(db.$client.waitingCount, 1);
  for (let i = 0; i < 40; i++) await getDatabaseHealthStatus();
  equal(db.$client.waitingCount, 1);
  clients.forEach((client) => client.release());
  await Bun.sleep(650);
  equal(await getDatabaseHealthStatus(), 'up');
}
if (mode !== 'database-down') {
  const { apiIpRateLimit } =
    await import('../src/server/lib/hono/apiIpRateLimit');
  const { redis } = await import('../src/server/lib/redis');
  process.env.API_IP_RATE_LIMIT_MAX_REQUESTS = '2';
  process.env.API_IP_RATE_LIMIT_WINDOW_SECONDS = '60';
  process.env.TRUSTED_PROXY_IPS = '';
  const app = new Hono();
  app.use('/api/*', apiIpRateLimit());
  app.all('/api/*', (c) => c.json({ reached: true }));
  const peer = '192.0.2.240';
  const env = { requestIP: () => ({ address: peer, family: 'IPv4' }) };
  if (mode === 'healthy') {
    await redis.del(`api:rate-limit:ip:${peer}`);
    for (let i = 0; i < 3; i++) {
      const response = await app.request(
        '/api/tasks',
        {
          headers: {
            'cf-connecting-ip': `203.0.113.${i + 1}`,
            'x-forwarded-for': `203.0.113.${i + 1}`,
            'x-real-ip': `203.0.113.${i + 1}`,
          },
        },
        env,
      );
      equal(response.status, i < 2 ? 200 : 429);
    }
    equal(await redis.exists(`api:rate-limit:ip:${peer}`), 1);
    await redis.del(`api:rate-limit:ip:${peer}`);
  } else {
    equal(
      (await app.request('/api/save-character', { method: 'POST' }, env))
        .status,
      503,
    );
    equal((await app.request('/api/tasks', {}, env)).status, 200);
    equal((await app.request('/api/live', {}, env)).status, 200);
  }
}
console.log(
  JSON.stringify({
    suite: 'http-health-integration',
    mode,
    checks,
    passed: true,
  }),
);
process.exit(0);
