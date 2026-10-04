import type { DungeonRewardTier } from '@daoyou/game-domain/dungeon/settlement';

export const DUNGEON_TIER_MIN_TOTAL_MATERIALS: Record<
  DungeonRewardTier,
  number
> = {
  S: 4,
  A: 3,
  B: 2,
  C: 0,
  D: 0,
};
