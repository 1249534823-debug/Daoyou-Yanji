import type { BodyCultivationTrackKey } from '../condition.js';
import type { CombatV6TrainingPlayerInput } from './encounter.js';

/** Frozen combat facts exclude home-site account, resources and condition history. */
export type CrossServerCombatBuild = Omit<
  CombatV6TrainingPlayerInput,
  'cultivator'
> & {
  cultivator: Omit<CombatV6TrainingPlayerInput['cultivator'], 'condition'>;
  bodyLevels?: Record<BodyCultivationTrackKey, number>;
};
