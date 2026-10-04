import { createWildStateSchemas } from '@daoyou/game-domain/wild/state-schema';
import { createWildEncounterSchema } from '@daoyou/game-domain/wild/encounter';
import { ItemGrantSchema } from '../../inventory/index.js';
import { BeastSchema } from '../../beasts/schema.js';
import { WildIndividualSchema } from './generator.js';
export const { WildRuntimeSchema, WildSettlementSchema } = createWildStateSchemas({ ItemGrantSchema, BeastSchema, WildIndividualSchema });
export const WildEncounterSchema = createWildEncounterSchema(WildIndividualSchema);
