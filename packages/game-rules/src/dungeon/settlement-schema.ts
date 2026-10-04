import { createDungeonSettlementSchema } from '@daoyou/game-domain/dungeon/state';
import { ItemGrantSchema } from '../inventory/index.js';

export const DungeonSettlementSchema =
  createDungeonSettlementSchema(ItemGrantSchema);
