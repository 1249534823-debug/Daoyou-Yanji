import type { SectDiscipleRank } from '@daoyou/game-domain/sects/organization';
export * from '@daoyou/game-domain/sects/organization';
import { getRealmStageRank } from '@daoyou/game-domain/progression/realms';

import type { RealmStage, RealmType } from '@daoyou/constants/realms';

export const SECT_RANK_METHOD_CAP = {
  registered: 45,
  outer: 90,
  inner: 135,
  true: 180,
} as const satisfies Record<SectDiscipleRank, number>;

export function getEffectiveSectMethodLevelCap(args: {
  realmCap: number;
  rank: SectDiscipleRank;
  facilityCap: number;
  rankCap?: number;
}): number {
  return Math.min(
    args.realmCap,
    args.rankCap ?? SECT_RANK_METHOD_CAP[args.rank],
    args.facilityCap,
  );
}

export function realmMeetsSectRank(
  realm: RealmType,
  stage: RealmStage,
  requiredRealm: RealmType,
): boolean {
  return (
    getRealmStageRank(realm, stage) >= getRealmStageRank(requiredRealm, '初期')
  );
}
