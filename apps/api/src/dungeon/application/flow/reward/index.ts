/**
 * 副本奖励系统 - 模块导出
 */

export {
  QUALITY_HINT_OFFSET,
  REALM_REWARD_CONFIG,
  TIER_MULTIPLIER,
} from '@server/dungeon/application/flow/reward/rewardConfig';
export { RewardFactory } from '@server/dungeon/application/flow/reward/RewardFactory';
export type {
  RewardBlueprint,
  RewardRangeConfig,
  RewardType,
  ValueRange,
} from '@server/dungeon/application/flow/reward/types';
