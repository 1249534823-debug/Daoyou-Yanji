import { artifactMigrationRealm } from '@shared/artifact-migration/rules';
import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@shared/engine/combat-v6/equipment/content';
import { compileDaoEquipmentSpecialLoadoutV1 } from '@shared/engine/combat-v6/equipment/compiler';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { ForgedEquipmentNameSchema, ForgedEquipmentDescSchema } from '@shared/forging/narrative';
import { assertConsumableSpec } from '@shared/lib/consumables';
import { ItemGrantSchema, type ItemGrant } from '@shared/inventory';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import { seedFactsOf } from '@shared/items/definitions/seeds';
import {
  ItemLibraryArtifactPayloadSchema,
  ItemLibraryConsumablePayloadSchema,
  ItemLibraryMaterialPayloadSchema,
} from '@shared/lib/itemLibrary';
import { QUALITY_VALUES } from '@shared/types/constants';
import { createHash } from 'node:crypto';

export type LegacyLibraryInventorySource = {
  itemId: string;
  type: 'material' | 'consumable' | 'artifact';
  payload: unknown;
  createdAt?: Date | string;
};

/** Stable catalog facts. Call materializeRewardItem(grant, randomUUID) for each
 * equipment delivery: the catalog identity must never become a player asset ID.
 * Invalid/retired facts throw so callers retain the configured reward for review. */
export function legacyLibraryInventoryGrant(
  source: LegacyLibraryInventorySource,
  quantity = 1,
): ItemGrant {
  if (!source.itemId.trim()) throw new Error('旧道具库条目缺少稳定 ID');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
    throw new Error('单次道具数量必须为 1 至 99');
  if (source.type === 'material') {
    const payload = ItemLibraryMaterialPayloadSchema.parse(source.payload);
    return ItemGrantSchema.parse({
      definitionId: payload.type === 'seed' ? 'seed.v1' : 'material.v1',
      quantity,
      instanceData:
        payload.type === 'seed'
          ? seedFactsOf(payload)
          : MaterialFactsSchema.parse({
              name: payload.name,
              type: payload.type,
              rank: payload.rank,
              element: payload.element ?? null,
              description: payload.description ?? '',
            }),
    });
  }
  if (source.type === 'consumable') {
    const payload = ItemLibraryConsumablePayloadSchema.parse(source.payload);
    return ItemGrantSchema.parse({
      definitionId: 'consumable.v1',
      quantity,
      instanceData: consumableFactsOf({ ...payload, quantity, spec: assertConsumableSpec(payload.spec) }),
    });
  }
  if (quantity !== 1) throw new Error('道装必须逐件发放并生成独立身份');
  const payload = ItemLibraryArtifactPayloadSchema.parse(source.payload);
  const slot = payload.slot === 'accessory' ? 'necklace' : payload.slot;
  const template = DAO_EQUIPMENT_TEMPLATES_V1.find((item) => item.slot === slot);
  if (!template) throw new Error('旧法宝部位没有对应的道装模板');
  const qualityIndex = QUALITY_VALUES.indexOf(payload.quality ?? '凡品');
  const seed = createHash('sha256')
    .update(`legacy-library-v0415:${source.itemId}`)
    .digest()
    .readUInt32BE(0);
  const createdAt = source.createdAt
    ? new Date(source.createdAt).toISOString()
    : '2026-09-30T16:00:00.000Z';
  const result = generateForgedEquipment({
    id: `legacy-library:${source.itemId}`,
    createdAt,
    seed,
    baseQuality: qualityIndex / (QUALITY_VALUES.length - 1),
    templateId: template.id,
    equipmentLevel: artifactMigrationRealm(payload.productModel).equipmentLevel,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!result.ok)
    throw new Error(result.diagnostics.map((item) => item.message).join('；'));
  // Current V5 forging permits custom copy, but only within its published
  // narrative contract. Original library facts remain untouched for auditing.
  const name = ForgedEquipmentNameSchema.safeParse(payload.name);
  const desc = ForgedEquipmentDescSchema.safeParse(payload.description);
  const instance = {
    ...result.instance,
    ...(name.success ? { name: name.data } : {}),
    ...(desc.success ? { desc: desc.data } : {}),
    element: payload.element,
  };
  const compiled = compileDaoEquipmentSpecialLoadoutV1(
    { [instance.slot]: instance },
    180,
  );
  if (!compiled.ok)
    throw new Error(compiled.diagnostics.map((item) => item.message).join('；'));
  return ItemGrantSchema.parse({
    definitionId: 'equipment.v6',
    quantity: 1,
    instanceData: instance,
  });
}
