import type {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@daoyou/game-domain/dungeon/state';
import type { ResourceOperation } from '@daoyou/game-domain/resources/operations';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}
