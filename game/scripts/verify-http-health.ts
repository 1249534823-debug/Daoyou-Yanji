/** Isolated verification; does not contact production or mutate application data. */
import { Hono } from 'hono';
import assert from 'node:assert/strict';
import { boundedProbe } from '../src/server/lib/health/boundedProbe';
import {
  getRequestIp,
  normalizeIp,
  resolveRequestIp,
} from '../src/server/lib/http/requestIp';

let checks = 0;
function equal(actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected);
  checks++;
}
equal(normalizeIp('2001:0db8:0:0:0:0:0:1'), '2001:db8::1');
equal(normalizeIp('::ffff:192.0.2.4'), '192.0.2.4');
for (const invalid of [
  '1.2.3.4:80',
  '1.2.3.4,5.6.7.8',
  'fe80::1%eth0',
  'hello',
  '010.0.0.1',
])
  equal(normalizeIp(invalid), undefined);
equal(resolveRequestIp('192.0.2.1', '198.51.100.2', ''), '192.0.2.1');
equal(
  resolveRequestIp('192.0.2.1', '198.51.100.2', '192.0.2.1'),
  '198.51.100.2',
);
equal(resolveRequestIp('192.0.2.1', 'forged', '192.0.2.1'), '192.0.2.1');
equal(resolveRequestIp(undefined, '198.51.100.2', '192.0.2.1'), undefined);
equal(
  resolveRequestIp('::ffff:192.0.2.1', '2001:0db8::1', '192.0.2.1'),
  '2001:db8::1',
);
const app = new Hono();
app.get('/', (c) => c.json({ ip: getRequestIp(c) }));
const result = await app.request(
  '/',
  {
    headers: {
      'cf-connecting-ip': '203.0.113.99',
      'x-forwarded-for': '203.0.113.99',
    },
  },
  { requestIP: () => ({ address: '192.0.2.9', family: 'IPv4' }) },
);
equal(await result.json(), { ip: '192.0.2.9' });

let calls = 0;
let resolve!: (value: 'up') => void;
const check = boundedProbe(
  () => {
    calls++;
    return new Promise<'up'>((done) => {
      resolve = done;
    });
  },
  20,
  0,
);
equal(
  await Promise.all(Array.from({ length: 50 }, () => check())),
  Array(50).fill('down'),
);
equal(calls, 1);
equal(await check(), 'down');
equal(calls, 1); // timed-out acquire does not enqueue more work
resolve('up');
await new Promise((r) => setTimeout(r, 0));
const next = check();
await new Promise((r) => setTimeout(r, 0));
equal(calls, 2);
resolve('up');
equal(await next, 'up');
equal(
  await boundedProbe(async () => {
    throw new Error('offline');
  })(),
  'down',
);
equal(await boundedProbe(async () => 'up')(), 'up');
// Unconfigured limiter must deny writes/auth, but reviewed reads degrade open.
assert.equal(process.env.REDIS_URL, undefined, 'Run without a Redis URL');
const { apiIpRateLimit } =
  await import('../src/server/lib/hono/apiIpRateLimit');
const limited = new Hono();
limited.use('/api/*', apiIpRateLimit());
limited.all('/api/*', (c) => c.json({ reached: true }));
for (const [path, method, status] of [
  ['/api/tasks', 'GET', 200],
  ['/api/tasks/123', 'GET', 200],
  ['/api/tasks', 'POST', 503],
  ['/api/auth/sign-in/email', 'POST', 503],
  ['/api/auth/get-session', 'GET', 503],
  ['/api/secret-realms', 'GET', 503],
  ['/api/unknown', 'GET', 503],
  ['/api/live', 'GET', 200],
  ['/api/ready', 'GET', 200],
  ['/api/health-check', 'GET', 200],
] as const) {
  const response = await limited.request(path, { method });
  equal(response.status, status);
  if (status === 503) equal(response.headers.get('Retry-After'), '5');
}
console.log(
  JSON.stringify({ suite: 'http-health-rules', checks, passed: true }),
);
