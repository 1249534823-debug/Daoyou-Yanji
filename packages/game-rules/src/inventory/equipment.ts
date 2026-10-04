import { createInventoryEquipmentSchema } from '@daoyou/game-domain/equipment/inventory';
import { validateFormationInscriptions } from '../equipment/inscriptions.js';

export const InventoryEquipmentSchema = createInventoryEquipmentSchema(validateFormationInscriptions);
