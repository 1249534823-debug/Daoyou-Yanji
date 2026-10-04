import type { TowerWeek } from './weekly.js';
import type { RealmType } from '@daoyou/constants/realms';
import { TOWER_STRATEGY_VERSION } from '@daoyou/game-domain/tower/strategy';
import { compileTowerStrategy } from './strategy-compiler.js';
import { expandTowerFloor } from './strategy-templates.js';
export { type TowerNpcPlan } from '@daoyou/game-domain/tower/npc-plan';
export { TOWER_SKILLS, TOWER_STATUS_DEFS } from '@daoyou/game-content/tower/catalog';
export function compileTowerEncounter(
  realm: RealmType,
  floor: number,
  week: TowerWeek,
) {
  return compileTowerStrategy(
    realm,
    expandTowerFloor(week, floor),
    TOWER_STRATEGY_VERSION,
  );
}
