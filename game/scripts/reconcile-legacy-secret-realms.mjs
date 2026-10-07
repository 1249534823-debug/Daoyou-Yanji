/** Maintenance-only V5 drain. Default is a read-only plan; never grants a guessed reward.
 * Run with Bun using the ORIGINAL V5 checkout's environment and TS aliases.
 * Stop public writes, pause NPC settings, and wait for in-flight NPC leases first.
 * Example (paths/env are deployment-specific):
 * bun --env-file=/path/to/legacy.env --tsconfig-override=/path/to/legacy/tsconfig.node.json scripts/reconcile-legacy-secret-realms.mjs --source-root=/path/to/legacy --database=expected_db
 * Add --execute only after reviewing the plan. Re-running is safe: finished runs are excluded,
 * and original DungeonApplicationService locks / terminal guards / action IDs remain authoritative.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = new Set(process.argv.slice(2));
const value = (name) =>
  [...args].find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sourceRoot = value('source-root');
const expectedDatabase = value('database');
assert(
  sourceRoot && expectedDatabase,
  'Pass --source-root=original_V5_checkout and --database=expected_name',
);
assert(
  process.env.DATABASE_URL && process.env.REDIS_URL,
  'Explicit original runtime environment is required',
);
assert.equal(
  decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)),
  expectedDatabase,
  'Database target mismatch',
);
const root = resolve(sourceRoot);
const oldCombat = await readFile(
  resolve(root, 'src/server/lib/services/SecretRealmCombat.ts'),
  'utf8',
);
assert(
  oldCombat.includes('battle-v5') && oldCombat.includes('version: 1'),
  'Source must be the preserved V5 checkout, not the upgraded candidate',
);
const requireFromLegacy = createRequire(resolve(root, 'package.json'));
const { Pool } = requireFromLegacy('pg');
const readPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  options:
    '-c default_transaction_read_only=on -c statement_timeout=10000 -c application_name=daoyou-legacy-drain-plan',
});
const list = async () =>
  (
    await readPool.query(`
  SELECT r.id, r.cultivator_id, c.user_id, r.status, r.current_round, r.max_rounds,
    r.run_state, EXISTS(SELECT 1 FROM public.wanjiedaoyou_npc_actors n WHERE n.cultivator_id=r.cultivator_id) AS is_npc
  FROM public.wanjiedaoyou_dungeon_runs r
  JOIN public.wanjiedaoyou_cultivators c ON c.id=r.cultivator_id
  WHERE r.map_node_id='SAT_TIANLING_01' AND r.status<>'FINISHED' AND r.ended_at IS NULL
  ORDER BY r.id LIMIT 21`)
  ).rows;
const ensurePaused = async () => {
  const { rows } = await readPool.query(
    "SELECT config FROM public.wanjiedaoyou_npc_world_settings WHERE id='world'",
  );
  assert.equal(
    rows[0]?.config?.enabled,
    false,
    'NPC world scheduler must be explicitly paused',
  );
  const active = await readPool.query(
    'SELECT count(*)::int AS count FROM public.wanjiedaoyou_npc_actors WHERE current_action_id IS NOT NULL AND lease_until > now()',
  );
  assert.equal(
    active.rows[0].count,
    0,
    'Wait for in-flight NPC actions / leases before draining',
  );
};
const stableId = (runId, operation) => {
  const hex = createHash('sha256')
    .update(`upgrade-v0415:${runId}:${operation}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
let exitCode = 0;
try {
  const initial = await list();
  assert(
    initial.length <= 20,
    'Unexpected active run count; review before proceeding',
  );
  console.log(
    JSON.stringify({
      mode: args.has('--execute') ? 'execute' : 'plan',
      database: expectedDatabase,
      runs: initial.map((run) => ({
        id: run.id,
        status: run.status,
        round: run.current_round,
        maxRounds: run.max_rounds,
        isNpc: run.is_npc,
        version: run.run_state?.secretRealm?.version,
        defeatedRounds: run.run_state?.secretRealm?.defeatedRounds ?? [],
        rewardRule: run.run_state?.rewardSnapshot
          ? 'frozen-snapshot'
          : 'legacy-default-one-tianling-pill',
      })),
    }),
  );
  if (args.has('--execute')) {
    await ensurePaused();
    assert(
      initial.every((run) => run.is_npc),
      'A human player has an active run; leave it untouched for an explicit progress-preservation decision',
    );
    assert(
      initial.every((run) => run.run_state?.secretRealm?.version === 1),
      'Only legacy Tianling v1 sessions may be drained',
    );
    const importLegacy = (path) =>
      import(pathToFileURL(resolve(root, path)).href);
    const { dungeonService } = await importLegacy(
      'src/server/lib/dungeon/service_v2.ts',
    );
    const { executeDungeonCommand } = await importLegacy(
      'src/server/lib/services/DungeonApplicationService.ts',
    );
    for (const run of initial) {
      for (let step = 0; step < 20; step++) {
        await ensurePaused();
        const current = (
          await readPool.query(
            'SELECT status,ended_at FROM public.wanjiedaoyou_dungeon_runs WHERE id=$1',
            [run.id],
          )
        ).rows[0];
        if (current?.status === 'FINISHED' && current.ended_at) break;
        const state = await dungeonService.getState(run.cultivator_id);
        assert.equal(
          state?.runId,
          run.id,
          'Active run changed; do not touch a replacement run',
        );
        assert.equal(state?.secretRealm?.version, 1);
        let command;
        if (
          ['WAITING_BATTLE', 'IN_BATTLE'].includes(state.status) &&
          state.activeBattleId
        ) {
          command = {
            kind: 'battle-execute',
            battleId: state.activeBattleId,
            requestId: stableId(run.id, `battle:${state.activeBattleId}`),
          };
        } else if (state.status === 'LOOTING') {
          command = { kind: 'looting-continue' };
        } else if (state.status === 'EXPLORING') {
          const option = state.currentOptions?.find((item) =>
            item.costs?.some((cost) => cost.type === 'battle'),
          );
          assert(option, 'No genuine Tianling battle option; leave run intact');
          command = {
            kind: 'action',
            choiceId: option.id,
            actionId: stableId(run.id, `action:${state.currentRound}`),
          };
        } else if (state.status === 'RECOVERABLE_ERROR') {
          const action = state.recoverableActions?.find((name) =>
            ['retry_settle', 'retry_continue', 'retry'].includes(name),
          );
          assert(action, 'No safe retry is available; leave run intact');
          command = { kind: 'recover', action };
        } else
          throw new Error(
            `Unsupported legacy state ${state.status}; run ${run.id} remains intact`,
          );
        await executeDungeonCommand({
          userId: run.user_id,
          cultivatorId: run.cultivator_id,
          command,
        });
        console.log(
          JSON.stringify({
            runId: run.id,
            step: step + 1,
            command: command.kind,
          }),
        );
      }
      const after = (
        await readPool.query(
          'SELECT status,ended_at,run_state FROM public.wanjiedaoyou_dungeon_runs WHERE id=$1',
          [run.id],
        )
      ).rows[0];
      assert(
        after?.status === 'FINISHED' && after.ended_at,
        `Run ${run.id} did not finish within the bounded drain; no forced rewards/refunds performed`,
      );
      console.log(
        JSON.stringify({
          runId: run.id,
          status: after.status,
          defeatedRounds: after.run_state?.secretRealm?.defeatedRounds ?? [],
          settled:
            after.run_state?.gainLedger?.some(
              (entry) => entry.source === 'settlement',
            ) ?? false,
        }),
      );
    }
    assert.equal(
      (await list()).length,
      0,
      'Legacy active sessions remain; stop upgrade before switching runtime',
    );
    console.log('LEGACY_TIANLING_DRAIN_COMPLETE');
  }
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : 'Legacy drain failed');
} finally {
  await readPool.end();
  // Legacy imports own long-lived pools; all awaited game mutations are already committed.
  process.exit(exitCode);
}
