/** 仅供虚构账号的隔离预览，保留真实 Hono / Better Auth 权限边界。 */
import { websocket } from 'hono/bun';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

assert.equal(process.env.NODE_ENV, 'test');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.hostname, 'admin-test-db');
assert.equal(database.pathname, '/admin_ui_test');
assert.equal(new URL(process.env.REDIS_URL ?? '').hostname, 'admin-test-redis');
const natsServers = (process.env.NATS_SERVERS ?? '')
  .split(',')
  .map((value) => value.trim());
for (const server of natsServers) {
  assert.equal(new URL(server).hostname, 'admin-test-nats');
}
assert.ok(process.env.NATS_USER, 'Isolated NATS user is required');
assert.ok(process.env.NATS_PASSWORD, 'Isolated NATS password is required');
assert.equal(process.env.BETTER_AUTH_URL, 'http://localhost:38209');
assert.ok((process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32);
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'])
  delete process.env[key];

const fixtures = JSON.parse(
  await readFile('output/admin-ui-fixtures.json', 'utf8'),
) as {
  testOnly: boolean;
  origin: string;
  admin: { userId: string; email: string };
};
assert.equal(fixtures.testOnly, true);
assert.equal(fixtures.origin, process.env.BETTER_AUTH_URL);
assert.equal(fixtures.admin.email, 'admin-ui@example.invalid');
assert.match(fixtures.admin.userId, /^[0-9a-f-]{36}$/i);
process.env.ADMIN_EMAILS = fixtures.admin.email;
process.env.ADMIN_USER_IDS = fixtures.admin.userId;
// Import auth only after its ID allowlist is configured, exactly as in the verifier.
const { default: app } = await import('../src/server/app');
const clientRoot = resolve('output/mail-contribution/build/client');
const index = Bun.file(resolve(clientRoot, 'index.html'));
assert.ok(
  await index.exists(),
  'Build the admin client candidate before serving',
);

Bun.serve({
  port: 3000,
  hostname: '0.0.0.0',
  websocket,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return app.fetch(request, { server });
    // This preview only exposes game APIs and the SPA; no cron/maintenance routes.
    if (url.pathname.startsWith('/internal/'))
      return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Method not allowed', { status: 405 });
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Invalid path', { status: 400 });
    }
    const filePath = resolve(clientRoot, `.${pathname}`);
    if (filePath !== clientRoot && !filePath.startsWith(clientRoot + sep)) {
      return new Response('Invalid path', { status: 400 });
    }
    const fileStat = await stat(filePath).catch(() => null);
    const headers = { 'Cache-Control': 'no-store' };
    if (fileStat?.isFile())
      return new Response(
        request.method === 'HEAD' ? null : Bun.file(filePath),
        { headers },
      );
    if (extname(pathname)) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : index, { headers });
  },
});
console.log(
  'ADMIN_PREVIEW_READY',
  fixtures.origin,
  '(isolated fictional accounts only)',
);
