import type { TowerBlessings } from '@daoyou/game-domain/tower/runtime';

import type { TowerReward, TowerRewardPreview } from '@daoyou/game-domain/tower/reward';

import type { TowerBlessingChoice, TowerSeasonMeta } from '@daoyou/game-domain/tower/state';

import type { TowerEnemyPreview } from '@daoyou/game-domain/tower/preview';

import type { RealmType } from '@daoyou/constants/realms';

import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';

export type TowerSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;

export interface TowerView {
  rewardRealm: RealmType;
  rewardPreviews: TowerRewardPreview[];
  season: TowerSeasonMeta;
  eligible: boolean;
  rewards: TowerReward[];
  weeklyEnemies: TowerEnemyPreview[];
  state: null | {
    runId: string;
    season: TowerSeasonMeta;
    revision: number;
    realm: RealmType;
    floor: number;
    highestFloor: number;
    status: 'READY' | 'WAITING_BATTLE' | 'CHOOSING_BLESSING' | 'FINISHED';
    reason?:
      | 'defeat'
      | 'fled'
      | 'draw'
      | 'retreated'
      | 'clear'
      | 'expired'
      | 'realm_changed'
      | 'content_updated';
    blessings: TowerBlessings;
    choices: TowerBlessingChoice[];
    rewards: TowerReward[];
    battleId?: string;
    enemy?: TowerEnemyPreview;
  };
}
