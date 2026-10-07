/** Isolated manual acceptance; refuses production infrastructure. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
assert.equal(process.env.NODE_ENV, 'test');
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, 'admin-test-db');
assert.equal(url.pathname, '/admin_ui_test');
assert.equal(new URL(process.env.REDIS_URL ?? '').hostname, 'admin-test-redis');
const fixtures = await Bun.file('output/admin-ui-fixtures.json').json();
assert.equal(fixtures.testOnly, true);
const { db } = await import('../src/server/lib/drizzle/db');
const { cultivators } = await import('../src/server/lib/drizzle/schema');
const { eq, sql } = await import('drizzle-orm');
const { default: app } = await import('../src/server/app');
const { getSpiritStoneDaily, getSpiritStoneLedger } =
  await import('../src/server/lib/services/SpiritStoneStatisticsService');
const { beijingDate } =
  await import('../src/shared/contracts/spiritStoneStatistics');
const { playerCommandExecutor } =
  await import('../src/server/lib/services/CommandExecutors');
const { MailService } = await import('../src/server/lib/services/MailService');
const { claimCultivatorMail } =
  await import('../src/server/lib/services/PlayerMailApplicationService');
const { updateSpiritStones } =
  await import('../src/server/lib/services/cultivator/CultivatorStateRepository');
const date = beijingDate();
const checks: string[] = [];
const pass = (v: string) => {
  checks.push(v);
  console.log('LEDGER_PASS', v);
};
async function create(name: string, balance = 0) {
  const id = randomUUID();
  await db
    .insert(cultivators)
    .values({
      id,
      userId: fixtures.normal.userId,
      name,
      prompt: '隔离验收',
      realm: '筑基',
      realm_stage: '初期',
      vitality: 10,
      spirit: 10,
      speed: 10,
      willpower: 10,
      spirit_stones: balance,
    });
  return id;
}
const id = await create('隔离灵石验收' + randomUUID().slice(0, 6));
const emptyId = await create('隔离零流水道友');
const base = { date, page: 1, pageSize: 20, q: '' };
async function daily() {
  const v = await getSpiritStoneDaily({ ...base, q: '隔离灵石验收' });
  return v.players.find((p) => p.cultivatorId === id)!;
}
async function ledger() {
  return getSpiritStoneLedger({
    date,
    page: 1,
    pageSize: 100,
    cultivatorId: id,
  });
}
async function add(amount: number) {
  await db
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones}+${amount}` })
    .where(eq(cultivators.id, id));
}
assert.equal((await daily()).income, '0');
assert.equal((await ledger()).entries.length, 0);
pass('zero starting balances create no artificial income');
await db.transaction(async (tx) => {
  await tx
    .update(cultivators)
    .set({ spirit_stones: 100000 })
    .where(eq(cultivators.id, id));
  await tx
    .update(cultivators)
    .set({ spirit_stones: 20000 })
    .where(eq(cultivators.id, id));
});
assert.deepEqual(
  [(await daily()).income, (await daily()).expense, (await daily()).net],
  ['100000', '80000', '20000'],
);
pass('same transaction opposite movements retain gross income and expense');
const before = await daily();
await assert.rejects(
  db.transaction(async (tx) => {
    await tx
      .update(cultivators)
      .set({ spirit_stones: 1 })
      .where(eq(cultivators.id, id));
    throw new Error('isolated rollback');
  }),
);
assert.deepEqual(await daily(), before);
pass('balance ledger and aggregate rollback together');
await add(0);
assert.equal((await ledger()).total, 2);
pass('unchanged balance does not create ledger rows');
await Promise.all(Array.from({ length: 10 }, () => add(100)));
assert.equal((await daily()).income, '101000');
assert.equal((await daily()).transactionCount, 12);
pass('concurrent writes counted once each');
const requestId = randomUUID();
const run = () =>
  playerCommandExecutor.execute({
    userId: fixtures.normal.userId,
    cultivatorId: id,
    source: 'admin_isolated_adjustment',
    coordination: { mode: 'database-only' },
    allowEmpty: true,
    idempotency: { key: requestId, fingerprint: 'same-input' },
    command: async (tx) => {
      await tx
        .update(cultivators)
        .set({ spirit_stones: sql`${cultivators.spirit_stones}+500` })
        .where(eq(cultivators.id, id));
      return { result: true, resourceChanges: [] };
    },
  });
await run();
await run();
assert.equal((await daily()).income, '101500');
assert.equal((await ledger()).entries[0].sourceLabel, '后台调整');
pass('command replay does not duplicate and admin adjustment identified');
await add(1);
assert.equal((await ledger()).entries[0].source, 'other');
pass('transaction local source does not leak');
const mail = await db.transaction((tx) =>
  MailService.sendMail(
    id,
    '隔离灵石邮件',
    '验收',
    [{ type: 'spirit_stones', name: '灵石', quantity: 700 }],
    'reward',
    tx,
  ),
);
const beforeClaim = (await daily()).income;
await claimCultivatorMail({
  actor: { userId: fixtures.normal.userId, cultivatorId: id },
  mailId: mail.id,
});
assert.equal(BigInt((await daily()).income) - BigInt(beforeClaim), 700n);
assert.equal((await ledger()).entries[0].source, 'mail_claim');
await assert.rejects(
  claimCultivatorMail({
    actor: { userId: fixtures.normal.userId, cultivatorId: id },
    mailId: mail.id,
  }),
);
pass('mail counted only on actual claim and repeated claim blocked');
await db.transaction(async (tx) => {
  await tx
    .update(cultivators)
    .set({ spirit_stones: 999999990 })
    .where(eq(cultivators.id, id));
});
const preCap = BigInt((await daily()).income);
await db.transaction((tx) =>
  updateSpiritStones(fixtures.normal.userId, id, 100, tx),
);
assert.equal(BigInt((await daily()).income) - preCap, 10n);
pass('clamped gain records actual ten not requested hundred');
const removed = await create('隔离已删除道友', 150);
await db.delete(cultivators).where(eq(cultivators.id, removed));
const deleted = (await getSpiritStoneDaily({ ...base, q: '隔离已删除道友' }))
  .players[0];
assert.equal(deleted.deleted, true);
assert.equal(deleted.income, '150');
assert.equal(deleted.currentBalance, null);
pass('deleted player accounting retained');
const prior = await getSpiritStoneDaily({ ...base, date: '2000-01-01' });
assert.equal(prior.total, 0);
assert.equal(prior.summary.income, '0');
assert.equal((await getSpiritStoneDaily(base)).partialDay, true);
pass('coverage metadata no invented historical income');
const all = await getSpiritStoneDaily(base);
assert.ok(
  all.players.some(
    (p) => p.cultivatorId === emptyId && p.transactionCount === 0,
  ),
);
const first = await getSpiritStoneDaily({ ...base, pageSize: 1 });
const second = await getSpiritStoneDaily({ ...base, pageSize: 1, page: 2 });
assert.notEqual(first.players[0].cultivatorId, second.players[0].cultivatorId);
assert.equal(first.total, second.total);
pass('zero activity players and deterministic pagination');
assert.equal(
  (await getSpiritStoneDaily({ ...base, q: "%' OR 1=1 --" })).total,
  0,
);
pass('search treats metacharacters literally');
async function get(path: string, cookie = '') {
  const res = await app.request(fixtures.origin + path, {
    headers: { ...(cookie ? { cookie } : {}), origin: fixtures.origin },
  });
  return res;
}
for (const path of [
  '/api/admin/spirit-stones/daily',
  '/api/admin/spirit-stones/ledger?cultivatorId=' + id,
]) {
  assert.equal((await get(path)).status, 401);
  assert.equal((await get(path, fixtures.normal.cookie)).status, 403);
  assert.equal((await get(path, fixtures.admin.cookie)).status, 200);
}
pass('both endpoints enforce admin 401 and 403');
for (const query of [
  'date=2026-02-30',
  'date=bad',
  'page=0',
  'pageSize=101',
  'q=' + 'x'.repeat(101),
]) {
  assert.equal(
    (
      await get(
        '/api/admin/spirit-stones/daily?' + query,
        fixtures.admin.cookie,
      )
    ).status,
    400,
  );
}
assert.equal(
  (
    await get(
      '/api/admin/spirit-stones/ledger?cultivatorId=bad',
      fixtures.admin.cookie,
    )
  ).status,
  400,
);
pass('API validation rejects malformed date id and paging');
const sliced = await getSpiritStoneLedger({
  date,
  cultivatorId: id,
  page: 1,
  pageSize: 2,
});
assert.equal(sliced.entries.length, 2);
assert.ok(BigInt(sliced.entries[0].id) > BigInt(sliced.entries[1].id));
pass('ledger pagination newest first');
const timezone = await db.execute<{ a: string; b: string }>(
  sql`select to_char('2026-09-11T15:59:59Z'::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD') as a,to_char('2026-09-11T16:00:00Z'::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD') as b`,
);
assert.deepEqual(timezone.rows[0], { a: '2026-09-11', b: '2026-09-12' });
pass('Beijing midnight boundary');
const long = await create(
  '隔离中文长名称用于验证移动端统计卡片自动换行的修仙道友',
);
await db.transaction(async (tx) => {
  await tx.execute(
    sql`select set_config('daoyou.spirit_stone_source','admin_demo',true)`,
  );
  await tx
    .update(cultivators)
    .set({ spirit_stones: 123456 })
    .where(eq(cultivators.id, long));
  await tx
    .update(cultivators)
    .set({ spirit_stones: 23456 })
    .where(eq(cultivators.id, long));
});
await create('隔离同名道友');
await create('隔离同名道友');
for (let i = 0; i < 8; i++) await add(-1);
await Bun.write(
  'output/spirit-ledger/ui-fixtures.json',
  JSON.stringify({
    testOnly: true,
    date,
    playerId: id,
    emptyId,
    deletedId: removed,
    longId: long,
    checks: checks.length,
  }),
);
await Bun.write(
  'output/spirit-ledger/backend-verification.json',
  JSON.stringify({ passed: true, date, checks }),
);
console.log('LEDGER_RUNTIME_PASS', checks.length);
process.exit(0);
