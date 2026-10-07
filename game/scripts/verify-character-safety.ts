/** Real isolated Redis/Postgres checks. Never run against a production environment. */
import type { Cultivator } from '@shared/types/cultivator';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const dbUrl = new URL(process.env.DATABASE_URL ?? 'http://missing');
const redisUrl = new URL(process.env.REDIS_URL ?? 'http://missing');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(dbUrl.hostname, 'admin-test-db');
assert.equal(dbUrl.pathname, '/admin_ui_test');
assert.equal(redisUrl.hostname, 'admin-test-redis');
const { redis } = await import('@server/lib/redis');
const { db } = await import('@server/lib/drizzle/db');
const schema = await import('@server/lib/drizzle/schema');
const { eq, and } = await import('drizzle-orm');
const repo = await import('@server/lib/repositories/redisCultivatorRepository');
const { createCultivatorFromTemp, executeCultivatorCreationCommand } =
  await import('@server/lib/services/CultivatorCreationApplicationService');
const checks: string[] = [];
const users = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const [owner, stranger, competingOwner] = users;
const tempIds: string[] = [];
const character: Cultivator = {
  name: '隔离创角验证',
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
  spirit_stones: 0,
};
const fates = [0, 1, 2, 3].map((i) => ({
  name: `隔离气运${i}`,
  quality: '凡品' as const,
  effects: [],
}));
async function makeTemp(userId: string) {
  const id = await repo.saveTempCharacter(character, userId);
  tempIds.push(id);
  return id;
}
async function rejects(run: () => unknown) {
  await assert.rejects(async () => {
    await run();
  });
}
try {
  const temp = await makeTemp(owner);
  assert.equal(
    (await repo.getTempCharacter(temp, owner))?.name,
    character.name,
  );
  assert.equal(await repo.getTempCharacter(temp, stranger), null);
  assert.equal(
    (await repo.saveTempFates(temp, stranger, fates, 5)).expired,
    true,
  );
  await repo.deleteTempData(temp, stranger);
  assert.ok(await repo.getTempCharacter(temp, owner));
  checks.push('owner enforcement on reads, fates writes, deletion');
  const key = `temp_cultivator:${temp}`;
  await redis.expire(key, 90);
  assert.equal((await repo.saveTempFates(temp, owner, fates, 5)).remaining, 5);
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, () => repo.saveTempFates(temp, owner, fates, 5)),
  );
  assert.equal(outcomes.filter((x) => x.allowed).length, 5);
  assert.ok((await redis.ttl(key)) <= 90);
  assert.deepEqual(await repo.getTempCharacter(temp, owner), character);
  assert.deepEqual(await repo.getTempFates(temp, owner), fates);
  assert.equal(await repo.getTempFates(temp, stranger), null);
  checks.push(
    'atomic reroll cap with 12 concurrent requests; original expiry retained',
  );
  await rejects(() =>
    createCultivatorFromTemp({
      userId: stranger,
      tempCultivatorId: temp,
      selectedFateIndices: [0, 1, 2],
    }),
  );
  for (const selectedFateIndices of [
    [0, 0, 1],
    [0, 1, 1.5],
    [0, 1, 4],
  ]) {
    await rejects(() =>
      createCultivatorFromTemp({
        userId: owner,
        tempCultivatorId: temp,
        selectedFateIndices,
      }),
    );
  }
  assert.equal(
    (
      await db
        .select()
        .from(schema.cultivators)
        .where(eq(schema.cultivators.userId, owner))
    ).length,
    0,
  );
  checks.push('foreign owner and invalid selections do not create a character');
  const request = {
    userId: owner,
    tempCultivatorId: temp,
    selectedFateIndices: [0, 1, 2],
  };
  const saves = await Promise.allSettled(
    Array.from({ length: 6 }, () => createCultivatorFromTemp(request)),
  );
  assert.ok(saves.some((x) => x.status === 'fulfilled'));
  const rows = await db
    .select()
    .from(schema.cultivators)
    .where(eq(schema.cultivators.userId, owner));
  assert.equal(rows.length, 1);
  assert.equal(
    (
      await db
        .select()
        .from(schema.preHeavenFates)
        .where(eq(schema.preHeavenFates.cultivatorId, rows[0].id))
    ).length,
    3,
  );
  assert.equal(
    (
      await db
        .select()
        .from(schema.mails)
        .where(eq(schema.mails.cultivatorId, rows[0].id))
    ).length,
    1,
  );
  assert.equal(await repo.getTempCharacter(temp, owner), null);
  assert.equal((await createCultivatorFromTemp(request)).state.replayed, true);
  await rejects(() =>
    createCultivatorFromTemp({ ...request, selectedFateIndices: [0, 1, 3] }),
  );
  assert.equal(
    (
      await db
        .select()
        .from(schema.cultivators)
        .where(eq(schema.cultivators.userId, owner))
    ).length,
    1,
  );
  checks.push(
    '6 concurrent saves create exactly one character, three fates and one mail; retry replays after temp cleanup',
  );
  // Exercise DB fencing directly without a Redis lease, simulating competing holders.
  const direct = await Promise.allSettled(
    [0, 1].map(() =>
      db.transaction((tx) =>
        executeCultivatorCreationCommand(
          competingOwner,
          { ...character, pre_heaven_fates: fates.slice(0, 3) },
          tx,
        ),
      ),
    ),
  );
  assert.equal(direct.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    (
      await db
        .select()
        .from(schema.cultivators)
        .where(eq(schema.cultivators.userId, competingOwner))
    ).length,
    1,
  );
  checks.push(
    'database transaction lock fences concurrent creation without Redis coordination',
  );
  const expired = await makeTemp(stranger);
  await redis.del(`temp_cultivator:${expired}`);
  assert.equal(
    (await repo.saveTempFates(expired, stranger, fates, 5)).expired,
    true,
  );
  await rejects(() =>
    createCultivatorFromTemp({
      userId: stranger,
      tempCultivatorId: expired,
      selectedFateIndices: [0, 1, 2],
    }),
  );
  const legacy = crypto.randomUUID();
  tempIds.push(legacy);
  await redis.set(
    `temp_cultivator:${legacy}`,
    JSON.stringify(character),
    'EX',
    60,
  );
  assert.equal(await repo.getTempCharacter(legacy, owner), null);
  assert.equal(
    (await repo.saveTempFates(legacy, owner, fates, 5)).expired,
    true,
  );
  await repo.deleteTempData(legacy, owner);
  assert.ok(await redis.exists(`temp_cultivator:${legacy}`));
  checks.push(
    'expired and ownerless legacy drafts cannot be revived or claimed',
  );
  await writeFile(
    'output/character-safety-verification.json',
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        isolated: true,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} finally {
  for (const userId of users) {
    await db
      .delete(schema.cultivators)
      .where(eq(schema.cultivators.userId, userId));
    await db
      .delete(schema.resourceScopes)
      .where(
        and(
          eq(schema.resourceScopes.scopeKind, 'account'),
          eq(schema.resourceScopes.scopeKey, userId),
        ),
      );
  }
  for (const id of tempIds)
    await redis.del(
      `temp_cultivator:${id}`,
      `temp_fates:${id}`,
      `reroll_count:${id}`,
    );
}
process.exit(0);
