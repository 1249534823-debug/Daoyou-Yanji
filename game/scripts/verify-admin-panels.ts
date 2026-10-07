/** Only a schema-only, isolated database may be used. Never reads production rows or sends mail. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir } from 'node:fs/promises';

assert.equal(process.env.NODE_ENV, 'test');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.hostname, 'admin-test-db');
assert.equal(database.pathname, '/admin_ui_test');
assert.equal(new URL(process.env.REDIS_URL ?? '').hostname, 'admin-test-redis');
for (const value of (process.env.NATS_SERVERS ?? '').split(','))
  assert.equal(new URL(value).hostname, 'admin-test-nats');
const origin = 'http://localhost:38209';
assert.equal(process.env.BETTER_AUTH_URL, origin);
assert.ok((process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32);
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'])
  delete process.env[key];
const adminUserId = randomUUID();
process.env.ADMIN_USER_IDS = adminUserId;
process.env.ADMIN_EMAILS = 'admin-ui@example.invalid';
const { db } = await import('../src/server/lib/drizzle/db');
const { authUsers, authAccounts } =
  await import('../src/server/lib/auth/schema');
const { auth } = await import('../src/server/lib/auth/auth');
const { default: app } = await import('../src/server/app');
const password = `Panels-test-${randomUUID()}`;
const passwordHash = await (await auth.$context).password.hash(password);
async function actor(name: string, email: string, userId = randomUUID()) {
  assert.ok(email.endsWith('@example.invalid'));
  await db.insert(authUsers).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(authAccounts).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: passwordHash,
    updatedAt: new Date(),
  });
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: new Headers({ origin }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie);
  return { name, email, userId, cookie };
}
const admin = await actor(
  '万界道友•衍极界管理员',
  'admin-ui@example.invalid',
  adminUserId,
);
const normal = await actor(
  '界面验收道友',
  `panels-player-${randomUUID()}@example.invalid`,
);
const checks: { name: string; status: string; error?: string }[] = [];
async function request(
  path: string,
  cookie = admin.cookie,
  method = 'GET',
  body?: unknown,
) {
  return app.request(origin + path, {
    method,
    headers: { origin, cookie, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    checks.push({ name, status: 'pass' });
    console.log('PASS', name);
  } catch (error) {
    checks.push({ name, status: 'fail', error: String(error) });
    console.log('FAIL', name, String(error));
  }
}
await mkdir('output/admin-panels-verification', { recursive: true });
await Bun.write(
  'output/admin-ui-fixtures.json',
  JSON.stringify({ testOnly: true, origin, admin, normal }, null, 2),
);
await chmod('output/admin-ui-fixtures.json', 0o600);
for (const path of [
  '/api/admin/item-library',
  '/api/admin/templates',
  '/api/admin/secret-realms',
  '/api/admin/reputation-shop',
  '/api/admin/sect-shop',
]) {
  await check(path + ' permission and real list', async () => {
    assert.equal((await request(path, '')).status, 401);
    assert.equal((await request(path, normal.cookie)).status, 403);
    assert.equal((await request(path)).status, 200);
  });
}
await check('Invalid material generation does not write', async () => {
  const response = await request(
    '/api/admin/item-library/materials/generate',
    admin.cookie,
    'POST',
    { count: -1 },
  );
  assert.equal(response.status, 400);
});
await check('Generate actual materials for browser pagination', async () => {
  const response = await request(
    '/api/admin/item-library/materials/generate',
    admin.cookie,
    'POST',
    {
      count: 25,
      seed: 'admin-panels-test',
      materialType: 'herb',
      quality: '凡品',
      status: 'published',
    },
  );
  const data = (await response.json()) as {
    generated?: number;
    error?: string;
  };
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.generated, 25);
});
const passed = checks.filter((check) => check.status === 'pass').length;
await Bun.write(
  'output/admin-panels-verification/api-report.json',
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      isolated: true,
      passed,
      failed: checks.length - passed,
      checks,
    },
    null,
    2,
  ),
);
console.log(
  'PANELS_API_DONE',
  passed,
  'passed',
  checks.length - passed,
  'failed',
);
process.exit(checks.length === passed ? 0 : 1);
