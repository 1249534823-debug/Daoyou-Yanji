import { automaticCommands } from '@shared/combat-v6/auto';
import {
  carryDungeonBeastResources,
  createDungeonHost,
  DungeonHost,
  type DungeonTemplate,
} from '@shared/engine/combat-v6/dungeon/host';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';

export interface SecretRealmEncounter {
  level: number;
  template: DungeonTemplate;
  attributeScale: number;
  seed: number;
  name: string;
}
export interface SecretRealmCombatProgress {
  version: 2;
  encounters: SecretRealmEncounter[];
  defeatedRounds: number[];
}
function encounterSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/** Reuse the same V6 host for admission simulation and the real persisted battle. */
export function createSecretRealmHost(
  player: CombatV6TrainingPlayerInput,
  encounter: SecretRealmEncounter,
  beastResources: Record<string, { hp: number; mp: number }> = {},
) {
  const original = createDungeonHost(
    player,
    encounter.level,
    encounter.template,
    encounter.seed,
    'normal',
  ).runtimeSnapshot();
  const input = structuredClone(original.input);
  input.units = carryDungeonBeastResources(
    input.units,
    original.playerId,
    beastResources,
  ).map((unit) => {
    if (unit.side !== 1) return unit;
    const attrs = { ...unit.attrs };
    for (const key of [
      'hp',
      'maxHp',
      'physicalAtk',
      'magicAtk',
      'physicalDef',
      'magicDef',
    ] as const) {
      attrs[key] = Math.max(
        1,
        Math.round((attrs[key] ?? 0) * encounter.attributeScale),
      );
    }
    return { ...unit, name: encounter.name, attrs };
  });
  return new DungeonHost({
    version: original.version,
    playerId: original.playerId,
    input,
  });
}

/** Bounded seeded previews carry real character and beast losses across all three guards. */
export function matchSecretRealmEncounters(
  player: CombatV6TrainingPlayerInput,
  seed: string,
): SecretRealmCombatProgress {
  const preview = structuredClone(player);
  if (!preview.cultivator.condition) throw new Error('角色战斗状态尚未初始化');
  let beasts: Record<string, { hp: number; mp: number }> = {};
  const encounters: SecretRealmEncounter[] = [];
  const names = ['天灵巡山卫', '天灵护阵卫', '天灵镇境灵君'];
  const level = combatCharacterLevel(
    player.cultivator.realm,
    player.cultivator.realm_stage,
  );
  for (let round = 0; round < 3; round++) {
    let best:
      | {
          encounter: SecretRealmEncounter;
          score: number;
          hp: number;
          mp: number;
          beasts: typeof beasts;
        }
      | undefined;
    for (const attributeScale of [
      0.03, 0.08, 0.16, 0.3, 0.5, 0.7, 1, 1.4, 2, 4, 8,
    ]) {
      const encounter: SecretRealmEncounter = {
        level,
        template: round === 2 ? 'boss' : 'normal',
        attributeScale,
        seed: encounterSeed(`${seed}:${round}`),
        name: names[round],
      };
      let worst: { hp: number; mp: number; beasts: typeof beasts } | undefined;
      let score = 0;
      let won = true;
      for (let sample = 0; sample < 2; sample++) {
        const host = createSecretRealmHost(
          preview,
          { ...encounter, seed: (encounter.seed + sample) >>> 0 },
          beasts,
        );
        const initial = host.state.units.find(
          (unit) => unit.id === host.playerId,
        )!;
        const maxHp = initial.attrs.maxHp;
        const snapshot = host.runtimeSnapshot();
        for (let step = 0; step < 60 && !host.finished; step++) {
          const commands = automaticCommands(
            host.state,
            host.playerId,
            snapshot.input.skills ?? [],
            (id) =>
              host
                .controlledCommandOptions()
                .find((option) => option.unitId === id)!,
            {
              statusDefs: snapshot.input.statusDefs,
              strategies: { [host.playerId]: host.playerAutoStrategy },
            },
          );
          if (commands.length) host.submitGroup(commands);
          host.resolveRound();
        }
        if (!host.finished || host.trace().outcome !== 'victory') {
          won = false;
          break;
        }
        const final = host.state.units.find(
          (unit) => unit.id === host.playerId,
        )!;
        const next = {
          hp: final.attrs.hp,
          mp: final.attrs.mp,
          beasts: Object.fromEntries(
            host.state.units
              .filter((unit) => unit.ownerId === host.playerId)
              .map((unit) => [
                unit.id,
                { hp: unit.attrs.hp, mp: unit.attrs.mp },
              ]),
          ),
        };
        if (!worst || next.hp < worst.hp) worst = next;
        score +=
          Math.abs(
            initial.attrs.hp -
              final.attrs.hp -
              maxHp * (round === 2 ? 0.3 : 0.12),
          ) +
          maxHp * 0.02 * Math.abs(host.state.round - (round === 2 ? 7 : 4));
      }
      if (won && worst && (!best || score < best.score))
        best = { encounter, score, ...worst };
    }
    if (!best)
      throw new Error(
        '当前状态不足以稳妥挑战天灵秘境，请先恢复气血法力并检查宗门构筑、功法与道装。',
      );
    encounters.push(best.encounter);
    preview.cultivator.condition.resources.hp.current = best.hp;
    preview.cultivator.condition.resources.mp.current = best.mp;
    beasts = { ...beasts, ...best.beasts };
  }
  return { version: 2, encounters, defeatedRounds: [] };
}
