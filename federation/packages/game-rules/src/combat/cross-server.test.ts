import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { expect, it } from 'vitest';
import { generateStarterBeast } from '../beasts/generator.js';
import {
  CrossServerCombatBuildSchema,
  crossServerBattle,
  exportCrossServerBuild,
} from './cross-server.js';

const actorId = '00000000-0000-4000-8000-000000000001';
const scopedId = (side: 0 | 1, id: string) =>
  `${side === 0 ? 'aaaaaaaa' : 'bbbbbbbb'}${id.slice(8)}`;
function player(): CombatV6TrainingPlayerInput {
  const def = COMBAT_V6_SECT_DEFINITIONS.youdu;
  return {
    cultivator: {
      id: actorId,
      name: '道友',
      realm: '金丹',
      realm_stage: '初期',
      attributes: {
        vitality: 50,
        strength: 50,
        spirit: 50,
        endurance: 50,
        speed: 50,
        willpower: 50,
      },
    },
    sect: {
      version: 1,
      sectId: 'youdu',
      methods: Object.fromEntries(def.methods.map((method) => [method.id, 1])),
      activePathId: def.paths[0].id,
      meridianDepth: 0,
      meridianLoadouts: def.paths.map((path) => ({
        pathId: path.id,
        nodeIds: [],
        revision: 0,
      })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
    },
    equipment: {},
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
  };
}
it('冻结仅携带战斗训练与已携带灵兽，不传当前资源、丹毒和状态历史', () => {
  const input = player();
  const track = () => ({ level: 1, progress: 13 });
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 13 }, mp: { current: 7 } },
    gauges: { pillToxicity: 42 },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: 'mortal_body',
        milestones: {},
        tracks: {
          skin: track(),
          sinew_bone: track(),
          organs: track(),
          qi_blood: track(),
          primordial_spirit: track(),
        },
      },
      tempering: {
        vitality: track(),
        spirit: track(),
        wisdom: track(),
        speed: track(),
        willpower: track(),
      },
      marrowWash: track(),
    },
    counters: {
      longTermPillUsesByRealm: { 金丹: 4 },
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
  };
  input.cultivator.condition = condition;
  const carried = generateStarterBeast(
    '00000000-0000-4000-8000-000000000002',
    actorId,
    BEAST_SPECIES[0].id,
    1,
  );
  const uncarried = generateStarterBeast(
    '00000000-0000-4000-8000-000000000003',
    actorId,
    BEAST_SPECIES[0].id,
    2,
  );
  input.beasts = {
    beasts: [carried, uncarried],
    lineup: {
      carriedBeastIds: [carried.id],
      leadBeastId: carried.id,
      revision: 0,
    },
  };
  // The production roster includes account-side information outside the combat input type.
  Object.assign(input.beasts, {
    ownerLevel: 20,
    spiritStones: 9999,
    starterClaimed: true,
  });
  const before = structuredClone(input);
  const exported = exportCrossServerBuild(input);
  expect(exported.cultivator).not.toHaveProperty('condition');
  expect(exported.beasts).not.toHaveProperty('ownerLevel');
  expect(exported.beasts).not.toHaveProperty('spiritStones');
  expect(exported.beasts).not.toHaveProperty('starterClaimed');
  expect(exported.bodyLevels).toEqual({
    skin: 1,
    sinew_bone: 1,
    organs: 1,
    qi_blood: 1,
    primordial_spirit: 1,
  });
  expect(exported.beasts?.beasts.map((beast) => beast.id)).toEqual([
    carried.id,
  ]);
  const trace = crossServerBattle(exported, exported, 42, scopedId);
  expect(
    trace.initialUnits.every(
      (unit) =>
        unit.attrs!.hp === unit.attrs!.maxHp &&
        unit.attrs!.mp === unit.attrs!.maxMp,
    ),
  ).toBe(true);
  expect(input).toEqual(before);
});
it('两站相同角色及灵兽 ID 不冲突，复算一致且不改冻结输入', () => {
  const input = player();
  const beast = generateStarterBeast(
    '00000000-0000-4000-8000-000000000004',
    actorId,
    BEAST_SPECIES[0].id,
    1,
  );
  input.beasts = {
    beasts: [beast],
    lineup: { carriedBeastIds: [beast.id], leadBeastId: beast.id, revision: 0 },
  };
  const build = exportCrossServerBuild(input);
  const before = structuredClone(build);
  const trace = crossServerBattle(build, build, 123, scopedId);
  expect(trace.initialUnits).toHaveLength(4);
  expect(new Set(trace.initialUnits.map((unit) => unit.id)).size).toBe(4);
  expect(trace.finalState.result).toBeDefined();
  expect(trace.finalState.round).toBeLessThanOrEqual(100);
  expect(
    crossServerBattle(
      structuredClone(build),
      structuredClone(build),
      123,
      scopedId,
    ),
  ).toEqual(trace);
  expect(build).toEqual(before);
});
it('拒绝额外资产字段、非有限属性、伪造兽主与编组', () => {
  const build = exportCrossServerBuild(player());
  expect(
    CrossServerCombatBuildSchema.safeParse({
      ...build,
      account: { token: 'x' },
    }).success,
  ).toBe(false);
  expect(
    CrossServerCombatBuildSchema.safeParse({
      ...build,
      cultivator: { ...build.cultivator, spirit_stones: 1 },
    }).success,
  ).toBe(false);
  expect(
    CrossServerCombatBuildSchema.safeParse({
      ...build,
      cultivator: {
        ...build.cultivator,
        attributes: { ...build.cultivator.attributes, vitality: Infinity },
      },
    }).success,
  ).toBe(false);
  const foreign = generateStarterBeast(
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000099',
    BEAST_SPECIES[0].id,
    1,
  );
  expect(
    CrossServerCombatBuildSchema.safeParse({
      ...build,
      beasts: {
        beasts: [foreign],
        lineup: {
          carriedBeastIds: [foreign.id],
          leadBeastId: foreign.id,
          revision: 0,
        },
      },
    }).success,
  ).toBe(false);
  expect(
    CrossServerCombatBuildSchema.safeParse({
      ...build,
      beasts: {
        beasts: [],
        lineup: {
          carriedBeastIds: [foreign.id],
          leadBeastId: foreign.id,
          revision: 0,
        },
      },
    }).success,
  ).toBe(false);
});
