import { EQUIPMENT_SLOT_NAMES } from '@daoyou/game-domain/equipment/slot-names';
import { getLevelRealmStage } from '@daoyou/game-domain/progression/realms';

import { EQUIPMENT_LEVELS } from '@daoyou/game-domain/equipment/levels';

import { DAO_EQUIPMENT_SLOTS } from '@daoyou/game-domain/equipment/types';

export const BLUEPRINTS = DAO_EQUIPMENT_SLOTS.flatMap((slot) =>
  EQUIPMENT_LEVELS.map((level) => {
    return {
      id: `blueprint.${slot}.${level}`,
      name: `${getLevelRealmStage(level).realm}期${EQUIPMENT_SLOT_NAMES[slot]}`,
      kind: 'blueprint' as const,
      stackLimit: 99,
      slot,
      level,
    };
  }),
);
