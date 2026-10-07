import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { websocket } from 'hono/bun';




if (process.env.NODE_ENV !== 'test' || new URL(process.env.DATABASE_URL!).hostname !== 'feature-db') throw new Error('Isolated preview only');
await import('../src/server/lib/drizzle/db');
await import('../src/server/lib/auth/schema');
await import('../src/server/lib/auth/auth');
const { default: app } = await import('../src/server/app');
console.log('Preview modules loaded');
const report = JSON.parse(readFileSync('output/native-realm-verification.json', 'utf8'));
process.env.ADMIN_USER_IDS = report.admin.userId;
console.log('Preview serving');
const web = new Hono();
web.route('/', app);
Bun.serve({ port: 3000, websocket, async fetch(request, server) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/') || path.startsWith('/internal/')) return web.fetch(request, { server });
  if (path.includes('..')) return new Response('Invalid path', { status: 400 });
  const file = Bun.file('output/secret-realm-candidate/client' + path);
  if (await file.exists()) return new Response(file);
  return new Response(Bun.file('output/secret-realm-candidate/client/index.html'));
}});
