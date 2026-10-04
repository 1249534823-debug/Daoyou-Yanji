import { createBeastAllocateSchema } from '@daoyou/contracts/combatV6Beasts';
import { BeastAllocationSchema } from '@daoyou/game-rules/beasts/progression';

export const BeastAllocateSchema = createBeastAllocateSchema(BeastAllocationSchema);
