import { MAX_CRAFT_MATERIAL_QUANTITY } from '../config/itemQuantity';
import type { MaterialFacts } from '../items/definitions/materials';
import { materialFactsOf } from '../items/material';
import { findItemDefinition } from '../items/registry';
import type { InventoryItem } from './index';
import { inventoryStackIdentity } from './stack-key';

export type AlchemyBagMaterial = MaterialFacts & {
  id: string;
  quantity: number;
  members: Pick<InventoryItem, 'id' | 'revision' | 'quantity' | 'slotIndex'>[];
};
export function alchemyMaterialDoseProblem(
  materials: readonly AlchemyBagMaterial[],
  doses: Record<string, number> = {},
): string | null {
  const totals = new Map<string, number>();
  for (const material of materials) {
    const dose = doses[material.id] ?? 1;
    if (!Number.isInteger(dose) || dose < 1 || dose > MAX_CRAFT_MATERIAL_QUANTITY)
      return `每种材料每炉最多投入 ${MAX_CRAFT_MATERIAL_QUANTITY} 份`;
    const key = inventoryStackIdentity('material.v1', material)!;
    const total = (totals.get(key) ?? 0) + dose;
    if (total > MAX_CRAFT_MATERIAL_QUANTITY)
      return `每种材料每炉最多投入 ${MAX_CRAFT_MATERIAL_QUANTITY} 份`;
    totals.set(key, total);
  }
  return null;
}
/** Split stacks represent one ingredient, while different material facts remain distinct. */
export function groupAlchemyBagMaterials(
  items: InventoryItem[],
): AlchemyBagMaterial[] {
  const groups = new Map<string, AlchemyBagMaterial>();
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      item.location !== 'bag' ||
      findItemDefinition(item.definitionId)?.kind !== 'material'
    )
      continue;
    const facts = materialFactsOf(item.instanceData);
    // These materials are transferable; their gameplay use is not defined yet.
    if (facts.type === 'gongfa_manual' || facts.type === 'skill_manual')
      continue;
    const key = inventoryStackIdentity('material.v1', facts)!;
    const group = groups.get(key) ?? {
      ...facts,
      id: item.id,
      quantity: 0,
      members: [],
    };
    group.quantity += item.quantity;
    group.members.push({
      id: item.id,
      revision: item.revision,
      quantity: item.quantity,
      slotIndex: item.slotIndex,
    });
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Storage rows remain separate so paged selection keeps each row's stable ID. */
export function groupAlchemyStorageMaterials(
  items: InventoryItem[],
): AlchemyBagMaterial[] {
  return items
    .filter(
      (item) =>
        item.location === 'storage' &&
        findItemDefinition(item.definitionId)?.kind === 'material',
    )
    .flatMap((item) => {
      const facts = materialFactsOf(item.instanceData);
      return facts.type === 'gongfa_manual' || facts.type === 'skill_manual'
        ? []
        : [
            {
              ...facts,
              id: item.id,
              quantity: item.quantity,
              members: [
                {
                  id: item.id,
                  revision: item.revision,
                  quantity: item.quantity,
                  slotIndex: item.slotIndex,
                },
              ],
            },
          ];
    });
}
