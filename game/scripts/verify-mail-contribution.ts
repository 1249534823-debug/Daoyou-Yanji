/** Manual runtime acceptance using fictional users in the isolated database only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

assert.equal(process.env.NODE_ENV, 'test');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.hostname, 'admin-test-db');
assert.equal(database.pathname, '/admin_ui_test');
assert.equal(new URL(process.env.REDIS_URL ?? '').hostname, 'admin-test-redis');
for (const server of (process.env.NATS_SERVERS ?? '').split(',')) {
  assert.equal(new URL(server).hostname, 'admin-test-nats');
}
for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'])
  delete process.env[name];
const fixtures = await Bun.file('output/admin-ui-fixtures.json').json();
assert.equal(fixtures.testOnly, true);
assert.equal(fixtures.origin, 'http://localhost:38209');
const origin = fixtures.origin;
const { db } = await import('../src/server/lib/drizzle/db');
const { authUsers, authAccounts } =
  await import('../src/server/lib/auth/schema');
const { cultivators, sectMemberships, mails } =
  await import('../src/server/lib/drizzle/schema');
const { auth } = await import('../src/server/lib/auth/auth');
const { default: app } = await import('../src/server/app');
const { executeCultivatorCreationCommand } =
  await import('../src/server/lib/services/CultivatorCreationApplicationService');
const { MailService } = await import('../src/server/lib/services/MailService');
const { PRODUCTION_SECT_IDS } =
  await import('../src/shared/engine/sect/content');
const { eq, and } = await import('drizzle-orm');
const checks: string[] = [];
const pass = (name: string) => {
  checks.push(name);
  console.log('MAIL_CHECK_PASS', name);
};
const password = `Mail-test-${randomUUID()}`;
const passwordHash = await (await auth.$context).password.hash(password);
async function actor(name: string, sect = false) {
  const userId = randomUUID();
  const email = `mail-probe-${userId}@example.invalid`;
  await db
    .insert(authUsers)
    .values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await db
    .insert(authAccounts)
    .values({
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
    .map((v) => v.split(';')[0])
    .join('; ');
  const created = await db.transaction((tx) =>
    executeCultivatorCreationCommand(
      userId,
      {
        name,
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
        age: 18,
        lifespan: 120,
        attributes: {
          vitality: 10,
          strength: 10,
          spirit: 10,
          endurance: 10,
          speed: 10,
          willpower: 10,
        },
        spiritual_roots: [],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: { artifacts: [], consumables: [], materials: [] },
        equipped: { weapon: null, armor: null, accessory: null },
        spirit_stones: 1000,
      },
      tx,
    ),
  );
  // Character creation adds a welcome mail; isolate only these newly created fixtures.
  await db.delete(mails).where(eq(mails.cultivatorId, created.cultivatorId));
  await db.update(cultivators).set({ spirit_stones: 1000 }).where(eq(cultivators.id, created.cultivatorId));
  if (sect)
    await db
      .insert(sectMemberships)
      .values({
        cultivatorId: created.cultivatorId,
        sectId: PRODUCTION_SECT_IDS[0],
        status: 'active',
        joinedAt: new Date(),
        contribution: 20,
        lifetimeContribution: 100,
      });
  return { userId, cultivatorId: created.cultivatorId, cookie };
}
const member = await actor('隔离宗门邮件验收', true);
const outsider = await actor('隔离未入宗邮件验收');
const bulk = await actor('隔离批量邮件验收', true);
async function call(path: string, cookie: string, body: unknown) {
  const response = await app.request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      error: string;
      totalRecipients: number;
      rewardSummary: string[];
    },
  };
}
async function state(who: typeof member) {
  const c = await db.query.cultivators.findFirst({
    where: eq(cultivators.id, who.cultivatorId),
  });
  const m = await db.query.sectMemberships.findFirst({
    where: and(
      eq(sectMemberships.cultivatorId, who.cultivatorId),
      eq(sectMemberships.status, 'active'),
    ),
  });
  return {
    stones: c!.spirit_stones,
    contribution: m?.contribution,
    lifetime: m?.lifetimeContribution,
  };
}
async function mail(
  who: typeof member,
  quantity: number,
  stones = 0,
  invalidArtifact = false,
) {
  return db.transaction((tx) =>
    MailService.sendMail(
      who.cultivatorId,
      '隔离验收邮件',
      '测试附件',
      [
        { type: 'sect_contribution', name: '宗门贡献', quantity },
        ...(stones
          ? [{ type: 'spirit_stones' as const, name: '灵石', quantity: stones }]
          : []),
        ...(invalidArtifact
          ? [{ type: 'artifact' as const, name: '故障夹具法宝', quantity: 1 }]
          : []),
      ],
      'reward',
      tx,
    ),
  );
}
const broadcast = '/api/admin/broadcast/game-mail';
const base = {
  title: '隔离邮件贡献验收',
  content: '仅测试虚构角色',
  filters: { targetCultivatorId: member.cultivatorId },
  rewardSelections: [
    { type: 'sect_contribution', quantity: 250 },
    { type: 'spirit_stones', quantity: 70 },
  ],
};
assert.equal((await call(broadcast, '', base)).status, 401);
assert.equal((await call(broadcast, outsider.cookie, base)).status, 403);
pass('admin authorization');
for (const quantity of [0, -1, 1.5, 100_000_001]) {
  assert.equal(
    (
      await call(broadcast, fixtures.admin.cookie, {
        ...base,
        rewardSelections: [{ type: 'sect_contribution', quantity }],
      })
    ).status,
    400,
  );
}
assert.equal(
  (
    await db.query.mails.findMany({
      where: eq(mails.cultivatorId, member.cultivatorId),
    })
  ).length,
  0,
);
pass('API rejects invalid quantities without creating mail');
const preview = await call(broadcast, fixtures.admin.cookie, {
  ...base,
  dryRun: true,
});
assert.equal(preview.status, 200);
assert.equal(preview.body.totalRecipients, 1);
assert.equal(
  (
    await db.query.mails.findMany({
      where: eq(mails.cultivatorId, member.cultivatorId),
    })
  ).length,
  0,
);
pass('broadcast dry run is read only');
const sent = await call(broadcast, fixtures.admin.cookie, base);
assert.equal(sent.status, 200);
assert.equal(sent.body.totalRecipients, 1);
assert.deepEqual(sent.body.rewardSummary, ['宗门贡献 x250', '灵石 x70']);
const issued = (
  await db.query.mails.findMany({
    where: eq(mails.cultivatorId, member.cultivatorId),
  })
)[0];
assert.ok(issued);
assert.equal(issued.type, 'reward');
pass('admin broadcasts mixed contribution attachment to selected player');
const claimed = await call('/api/cultivator/mail/claim', member.cookie, {
  mailId: issued.id,
});
assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
assert.deepEqual(await state(member), {
  stones: 1070,
  contribution: 270,
  lifetime: 350,
});
assert.ok(
  JSON.stringify(claimed.body).includes('sect.mail_contribution_claimed'),
);
pass('single claim credits current and lifetime contribution with resources');
assert.equal(
  (
    await call('/api/cultivator/mail/claim', member.cookie, {
      mailId: issued.id,
    })
  ).status,
  400,
);
assert.deepEqual(await state(member), {
  stones: 1070,
  contribution: 270,
  lifetime: 350,
});
pass('repeat claim cannot double credit');
assert.equal(
  (
    await call('/api/cultivator/mail/claim', outsider.cookie, {
      mailId: issued.id,
    })
  ).status,
  404,
);
pass('mail ownership enforced');
const noSect = await mail(outsider, 40, 90);
const ordinary = await db.transaction((tx) =>
  MailService.sendMail(
    outsider.cultivatorId,
    '隔离普通邮件',
    '测试',
    [{ type: 'spirit_stones', name: '灵石', quantity: 5 }],
    'reward',
    tx,
  ),
);
const rejected = await call('/api/cultivator/mail/claim', outsider.cookie, {
  mailId: noSect.id,
});
assert.equal(rejected.status, 400);
assert.match(rejected.body.error, /加入宗门/);
const rejectedAll = await call(
  '/api/cultivator/mail/claim-all',
  outsider.cookie,
  {},
);
assert.equal(rejectedAll.status, 400);
assert.match(rejectedAll.body.error, /加入宗门/);
assert.deepEqual(await state(outsider), {
  stones: 1000,
  contribution: undefined,
  lifetime: undefined,
});
assert.equal(
  (
    await db.query.mails.findMany({
      where: eq(mails.cultivatorId, outsider.cultivatorId),
    })
  ).filter((m) => m.isClaimed).length,
  0,
);
pass('no-sect single and claim-all preserve all attachments and balances');
await db
  .insert(sectMemberships)
  .values({
    cultivatorId: outsider.cultivatorId,
    sectId: PRODUCTION_SECT_IDS[0],
    status: 'active',
    joinedAt: new Date(),
    contribution: 0,
    lifetimeContribution: 0,
  });
const afterJoin = await call(
  '/api/cultivator/mail/claim-all',
  outsider.cookie,
  {},
);
assert.equal(afterJoin.status, 200, JSON.stringify(afterJoin.body));
assert.deepEqual(await state(outsider), {
  stones: 1095,
  contribution: 40,
  lifetime: 40,
});
assert.equal(
  (await db.query.mails.findFirst({ where: eq(mails.id, ordinary.id) }))!
    .isClaimed,
  true,
);
pass('saved rewards become claimable after joining sect');
const broken = await mail(member, 12, 10, true);
const beforeBroken = await state(member);
assert.equal(
  (
    await call('/api/cultivator/mail/claim', member.cookie, {
      mailId: broken.id,
    })
  ).status,
  500,
);
assert.deepEqual(await state(member), beforeBroken);
assert.equal(
  (await db.query.mails.findFirst({ where: eq(mails.id, broken.id) }))!
    .isClaimed,
  false,
);
pass('downstream item failure rolls back contribution and ordinary currency');
const tooMany = await mail(member, 10, 10);
for (const limit of [
  { contribution: 2_147_483_642, lifetimeContribution: 100 },
  { contribution: 100, lifetimeContribution: 2_147_483_642 },
]) {
  await db
    .update(sectMemberships)
    .set(limit)
    .where(eq(sectMemberships.cultivatorId, member.cultivatorId));
  const before = await state(member);
  const result = await call('/api/cultivator/mail/claim', member.cookie, {
    mailId: tooMany.id,
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /上限/);
  assert.deepEqual(await state(member), before);
}
assert.equal(
  (await db.query.mails.findFirst({ where: eq(mails.id, tooMany.id) }))!
    .isClaimed,
  false,
);
pass('current and lifetime integer overflow preserve mail and balances');
const invalidStored = await mail(member, 0, 99);
const beforeInvalid = await state(member);
assert.equal(
  (
    await call('/api/cultivator/mail/claim', member.cookie, {
      mailId: invalidStored.id,
    })
  ).status,
  400,
);
assert.deepEqual(await state(member), beforeInvalid);
pass('persisted malformed contribution cannot be claimed');
const b1 = await mail(bulk, 30, 10);
const b2 = await mail(bulk, 50, 20);
const bulkResult = await call(
  '/api/cultivator/mail/claim-all',
  bulk.cookie,
  {},
);
assert.equal(bulkResult.status, 200, JSON.stringify(bulkResult.body));
assert.deepEqual(await state(bulk), {
  stones: 1030,
  contribution: 100,
  lifetime: 180,
});
assert.equal(
  (await call('/api/cultivator/mail/claim-all', bulk.cookie, {})).status,
  200,
);
assert.deepEqual(await state(bulk), {
  stones: 1030,
  contribution: 100,
  lifetime: 180,
});
assert.ok(
  (
    await db.query.mails.findMany({
      where: eq(mails.cultivatorId, bulk.cultivatorId),
    })
  ).every((m) => m.isClaimed),
);
pass('claim-all aggregates contribution exactly once across mail');
const race = await mail(bulk, 25, 5);
const responses = await Promise.all([
  call('/api/cultivator/mail/claim', bulk.cookie, { mailId: race.id }),
  call('/api/cultivator/mail/claim', bulk.cookie, { mailId: race.id }),
]);
assert.equal(responses.filter((r) => r.status === 200).length, 1);
assert.deepEqual(await state(bulk), {
  stones: 1035,
  contribution: 125,
  lifetime: 205,
});
pass('concurrent duplicate claim credits once');
console.log(
  'MAIL_RUNTIME_VERIFIED',
  JSON.stringify({
    checks: checks.length,
    names: checks,
    scope: 'isolated fictional actors only',
  }),
);
process.exit(0);
