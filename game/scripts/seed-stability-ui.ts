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

const { executeCultivatorCreationCommand } = await import('../src/server/lib/services/CultivatorCreationApplicationService');
const created = await db.transaction(tx => executeCultivatorCreationCommand(normal.userId, {
name:'隔离界面道友',gender:'男',realm:'炼气',realm_stage:'初期',age:18,lifespan:120,
attributes:{vitality:10,strength:10,spirit:10,endurance:10,speed:10,willpower:10},
spiritual_roots:[],pre_heaven_fates:[],cultivations:[],skills:[],inventory:{artifacts:[],consumables:[],materials:[]},equipped:{weapon:null,armor:null,accessory:null},spirit_stones:1000
},tx));
await Bun.write('output/admin-ui-fixtures.json',JSON.stringify({testOnly:true,origin,admin,normal:{...normal,cultivatorId:created.cultivatorId}}));
await chmod('output/admin-ui-fixtures.json',0o600);
console.log('ISOLATED_PLAYER_READY');process.exit(0);
