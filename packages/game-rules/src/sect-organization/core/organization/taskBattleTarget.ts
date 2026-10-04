import type {
  SectBattleTargetSnapshot,
  SectBattleTargetSummary,
} from '@daoyou/game-domain/sects/task-battle-target';
import { SectV6TargetSchema } from '@daoyou/game-domain/combat/sect-target';

import { REALM_VALUES } from '@daoyou/constants/realms';

import type { RealmType } from '@daoyou/constants/realms';

import type { SectBattleTargetAcquisition } from '@daoyou/game-domain/sects/organization-contracts';

export function resolveSectBattleTargetRealmCandidates(
  realm: RealmType,
  acquisition: SectBattleTargetAcquisition,
): readonly RealmType[] {
  if (acquisition === 'preset') return [realm];

  const realmIndex = REALM_VALUES.indexOf(realm);
  const previousRealm = REALM_VALUES[realmIndex - 1];
  return previousRealm ? [realm, previousRealm] : [realm];
}

export function readSectBattleTargetSnapshot(
  executorData: Record<string, unknown>,
): SectBattleTargetSnapshot | undefined {
  const parsed = SectV6TargetSchema.safeParse(executorData.battleTarget);
  return parsed.success ? parsed.data : undefined;
}

export function summarizeSectBattleTarget(
  snapshot: SectBattleTargetSnapshot,
): SectBattleTargetSummary {
  return {
    kind: snapshot.kind,
    name: snapshot.name,
    description: snapshot.description,
    realm: snapshot.realm,
    realmStage: snapshot.realmStage,
    ...(snapshot.kind === 'cultivator'
      ? {
          sectId: snapshot.sourceSectId,
          sectName: snapshot.sourceSectName,
        }
      : {}),
  };
}
