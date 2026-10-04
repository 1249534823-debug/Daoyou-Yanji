export {
  BEAST_SKILLS,
  BEAST_SPECIES,
  BEAST_STARTER_SPECIES,
  BEAST_STATUS_DEFS,
} from '@daoyou/game-content/beasts/content';
export { generateStarterBeast } from './generator.js';
export { beastDeathIds, loseBeastLifespan } from './progression.js';
export {
  activeBeastSkills,
  beastPanel,
  canDeployBeast,
  projectBeastRoster,
} from './projection.js';
export { BEAST_VERSION, BeastLineupSchema, type BeastLineup, type BeastRoster, type SummonedBeast } from '@daoyou/game-domain/beasts/schema';
export { BeastSchema } from './schema.js';

export type { BeastSpeciesDefinition } from '@daoyou/game-domain/beasts/pack';
export { rollBeastTraits, type BeastTraits } from './trait-generator.js';
