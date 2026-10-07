import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { BeastLineupSchema } from '@daoyou/game-domain/beasts';
import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';
import { AutoStrategySchema } from '@daoyou/game-domain/combat/auto';
import type { CrossServerCombatBuild } from '@daoyou/game-domain/combat/cross-server';
import type {
  BodyCultivationTrackKey,
  CultivatorCondition,
} from '@daoyou/game-domain/condition';
import { z } from 'zod';
import { BeastSchema } from '../beasts/schema.js';
import { InventoryEquipmentSchema } from '../inventory/equipment.js';
import { projectCharacterToCombatV6 } from './projection/project-character.js';
import {
  compileRankingBattle,
  simulateRankingBattle,
} from './ranking/battle.js';

const level = z.number().int().min(0).max(10000);
const id = z.string().min(1).max(160);
const loadout = z.strictObject({
  pathId: id,
  nodeIds: z.array(id).max(21),
  revision: z.number().int().nonnegative(),
});
const bodyKeys: BodyCultivationTrackKey[] = [
  'skin',
  'sinew_bone',
  'organs',
  'qi_blood',
  'primordial_spirit',
];
const shape = z.strictObject({
  cultivator: z.strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    realm: z.enum(REALM_VALUES),
    realm_stage: z.enum(REALM_STAGE_VALUES),
    attributes: z.strictObject({
      vitality: level,
      strength: level,
      spirit: level,
      endurance: level,
      speed: level,
      willpower: level,
    }),
  }),
  bodyLevels: z
    .strictObject({
      skin: level,
      sinew_bone: level,
      organs: level,
      qi_blood: level,
      primordial_spirit: level,
    })
    .optional(),
  sect: z
    .strictObject({
      version: z.literal(1),
      sectId: z.enum(['lingxiao', 'youdu', 'wuxiang', 'tianyan', 'jiujie']),
      methods: z
        .record(id, z.number().int().min(0).max(180))
        .refine((v) => Object.keys(v).length <= 6),
      meridianDepth: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
      ]),
      activePathId: id,
      meridianLoadouts: z.tuple([loadout, loadout]),
    })
    .optional(),
  equipment: z.strictObject({
    weapon: InventoryEquipmentSchema.optional(),
    head: InventoryEquipmentSchema.optional(),
    armor: InventoryEquipmentSchema.optional(),
    necklace: InventoryEquipmentSchema.optional(),
    belt: InventoryEquipmentSchema.optional(),
    footwear: InventoryEquipmentSchema.optional(),
  }),
  manuals: z.strictObject({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    learned: z
      .array(z.strictObject({ manualId: id, level, unlockedLevel: level }))
      .max(500),
    build: z.strictObject({
      slots: z
        .array(
          z.strictObject({
            slot: z.union([
              z.literal(1),
              z.literal(2),
              z.literal(3),
              z.literal(4),
            ]),
            manualId: id,
          }),
        )
        .max(4),
    }),
  }),
  beasts: z
    .strictObject({
      beasts: z.array(BeastSchema).max(6),
      lineup: BeastLineupSchema,
    })
    .optional(),
  portrait: z
    .enum(['icon:cultivator-male-avatar', 'icon:cultivator-female-avatar'])
    .optional(),
  autoStrategy: AutoStrategySchema.optional(),
});
type ParsedBuild = z.infer<typeof shape>;

function trainingPlayer(
  build: ParsedBuild | CrossServerCombatBuild,
): CombatV6TrainingPlayerInput {
  const { bodyLevels, ...player } = structuredClone(build);
  if (!bodyLevels) return player as CombatV6TrainingPlayerInput;
  // Neutral condition preserves only combat training; counters/statuses never travel.
  const track = () => ({ level: 0, progress: 0 });
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 0 }, mp: { current: 0 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: 'mortal_body',
        milestones: {},
        tracks: Object.fromEntries(
          bodyKeys.map((key) => [key, { level: bodyLevels[key], progress: 0 }]),
        ) as NonNullable<
          CultivatorCondition['tracks']['bodyCultivation']
        >['tracks'],
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
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
  };
  return {
    ...player,
    cultivator: { ...player.cultivator, condition },
  } as CombatV6TrainingPlayerInput;
}

export const CrossServerCombatBuildSchema = shape
  .superRefine((build, ctx) => {
    const projection = projectCharacterToCombatV6({
      ...trainingPlayer(build),
      side: 0,
      slot: 0,
      resourcePolicy: 'full',
    });
    if (!projection.ok)
      ctx.addIssue({ code: 'custom', message: '跨服构筑不符合当前战斗规则' });
    if (
      projection.ok &&
      Object.values(projection.unit.attrs).some(
        (n) => !Number.isFinite(n) || Math.abs(n) > 1e9,
      )
    ) {
      ctx.addIssue({ code: 'custom', message: '跨服战斗属性超出安全范围' });
    }
    const beasts = build.beasts;
    if (
      beasts &&
      (beasts.beasts.some((b) => b.ownerCultivatorId !== build.cultivator.id) ||
        beasts.lineup.carriedBeastIds.some(
          (id) => !beasts.beasts.some((b) => b.id === id),
        ) ||
        new Set(beasts.beasts.map((b) => b.id)).size !== beasts.beasts.length)
    ) {
      ctx.addIssue({ code: 'custom', message: '跨服灵兽归属或编组无效' });
    }
  })
  .transform((build) => build as unknown as CrossServerCombatBuild);

export function exportCrossServerBuild(
  player: CombatV6TrainingPlayerInput,
): CrossServerCombatBuild {
  const { condition, ...cultivator } = player.cultivator;
  const body = condition?.tracks.bodyCultivation;
  const carried = new Set(player.beasts?.lineup.carriedBeastIds ?? []);
  return CrossServerCombatBuildSchema.parse({
    ...player,
    cultivator,
    ...(body
      ? {
          bodyLevels: Object.fromEntries(
            bodyKeys.map((key) => [key, body.tracks[key].level]),
          ),
        }
      : {}),
    beasts: player.beasts
      ? {
          lineup: player.beasts.lineup,
          beasts: player.beasts.beasts.filter((b) => carried.has(b.id)),
        }
      : undefined,
  });
}

/** IDs are generated by the host's SHA-256 UUID namespace, never by a browser. */
export function crossServerBattle(
  challenger: CrossServerCombatBuild,
  defender: CrossServerCombatBuild,
  seed: number,
  namespacedId: (side: 0 | 1, id: string) => string,
) {
  const players = [challenger, defender].map((build, side) => {
    const player = trainingPlayer(CrossServerCombatBuildSchema.parse(build));
    player.cultivator.id = namespacedId(side as 0 | 1, player.cultivator.id);
    if (player.beasts) {
      player.beasts.beasts = player.beasts.beasts.map((beast) => ({
        ...beast,
        id: namespacedId(side as 0 | 1, beast.id),
        ownerCultivatorId: player.cultivator.id,
      }));
      player.beasts.lineup.carriedBeastIds =
        player.beasts.lineup.carriedBeastIds.map((id) =>
          namespacedId(side as 0 | 1, id),
        );
      if (player.beasts.lineup.leadBeastId)
        player.beasts.lineup.leadBeastId = namespacedId(
          side as 0 | 1,
          player.beasts.lineup.leadBeastId,
        );
    }
    return player;
  }) as [CombatV6TrainingPlayerInput, CombatV6TrainingPlayerInput];
  const input = compileRankingBattle(players, seed);
  return simulateRankingBattle(input);
}
