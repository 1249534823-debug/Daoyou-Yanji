/** Bounded pure V6 sample: no environment, DB, Redis, NATS, HTTP or production data.
 * Coordinator runs: bun --no-env-file scripts/check-tianling-v6-matching.mjs [--cases=1..3]
 */
import assert from 'node:assert/strict';
import { createSecretRealmHost } from '../src/server/lib/services/SecretRealmCombat.ts';
import { SecretRealmMatcher } from '../src/server/lib/services/SecretRealmMatcher.ts';
import { automaticCommands } from '../src/shared/combat-v6/auto.ts';
import { DungeonHost } from '../src/shared/engine/combat-v6/dungeon/host.ts';
import { projectCharacterToCombatV6 } from '../src/shared/engine/combat-v6/projection/index.ts';
import { towerReferenceBuild } from '../src/shared/engine/combat-v6/tower/reference-fixtures.ts';
const count = Number(
  process.argv.find((arg) => arg.startsWith('--cases='))?.split('=')[1] ?? 1,
);
assert(Number.isInteger(count) && count >= 1 && count <= 3);
const cases = [
  ['lingxiao', '金丹'],
  ['jiujie', '元婴'],
  ['youdu', '化神'],
].slice(0, count);
const matcher = new SecretRealmMatcher({
  workerUrl: new URL(
    '../src/server/workers/secretRealmMatcher.worker.ts',
    import.meta.url,
  ),
  executionTimeoutMs: 20000,
});
function finish(original, resume) {
  let host = original;
  for (let round = 0; round < 60 && !host.finished; round++) {
    const source = host.runtimeSnapshot();
    const commands = automaticCommands(
      host.state,
      host.playerId,
      source.input.skills ?? [],
      (id) =>
        host.controlledCommandOptions().find((option) => option.unitId === id),
      {
        statusDefs: source.input.statusDefs,
        strategies: { [host.playerId]: host.playerAutoStrategy },
      },
    );
    if (commands.length) host.submitGroup(commands);
    host.resolveRound();
    if (resume) {
      const snapshot = host.runtimeSnapshot();
      host = new DungeonHost(snapshot, snapshot);
    }
  }
  assert(host.finished, 'bounded simulation did not terminate');
  return host;
}
try {
  for (const [sect, realm] of cases) {
    const player = towerReferenceBuild(sect, realm, '中期');
    const projection = projectCharacterToCombatV6({
      ...player,
      side: 0,
      slot: 0,
      resourcePolicy: 'full',
    });
    assert(projection.ok, 'official reference build must project');
    player.cultivator.condition.resources.hp.current =
      projection.unit.attrs.maxHp;
    player.cultivator.condition.resources.mp.current =
      projection.unit.attrs.maxMp;
    const before = structuredClone(player),
      started = Date.now();
    const matched = await matcher.match(
      player,
      `tianling-v6:${sect}:${realm}`,
      new Date('2026-10-01T00:00:00Z'),
    );
    assert.equal(matched.version, 2);
    assert.equal(matched.encounters.length, 3);
    assert.deepEqual(player, before, 'matching must not mutate input');
    const repeated = await matcher.match(
      player,
      `tianling-v6:${sect}:${realm}`,
      new Date('2026-10-01T00:00:00Z'),
    );
    assert.deepEqual(
      matched,
      repeated,
      'same input and seed must match identically',
    );
    let beastResources = {};
    const rounds = [];
    for (const encounter of matched.encounters) {
      const direct = finish(
        createSecretRealmHost(player, encounter, beastResources),
        false,
      );
      const restored = finish(
        createSecretRealmHost(player, encounter, beastResources),
        true,
      );
      assert.equal(
        direct.trace().outcome,
        'victory',
        'matched encounter must be winnable by the reference strategy',
      );
      assert.deepEqual(
        direct.trace(),
        restored.trace(),
        'V6 save/restore must preserve state, RNG, events and outcome',
      );
      const final = direct.state.units.find(
        (unit) => unit.id === direct.playerId,
      );
      player.cultivator.condition.resources.hp.current = final.attrs.hp;
      player.cultivator.condition.resources.mp.current = final.attrs.mp;
      beastResources = {
        ...beastResources,
        ...Object.fromEntries(
          direct.state.units
            .filter((unit) => unit.ownerId === direct.playerId)
            .map((unit) => [unit.id, { hp: unit.attrs.hp, mp: unit.attrs.mp }]),
        ),
      };
      rounds.push({
        name: encounter.name,
        scale: encounter.attributeScale,
        rounds: direct.state.round,
        hp: final.attrs.hp,
        mp: final.attrs.mp,
      });
    }
    console.log(
      JSON.stringify({
        sect,
        realm,
        elapsedMs: Date.now() - started,
        rounds,
        deterministic: true,
        restored: true,
      }),
    );
  }
} finally {
  matcher.close();
}
await assert.rejects(matcher.match({}, 'closed'), /关闭/);
console.log('TIANLING_V6_MATCHING_PASS');
