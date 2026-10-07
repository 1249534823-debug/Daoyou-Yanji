import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { findPublishedItemLibraryByItemIds } from '@server/lib/repositories/itemLibraryRepository';
import { QI_OVERFLOW_MAX } from '@shared/config/qiSystem';
import { TIANLING_PILL } from '@shared/config/secretRealmPill';
import { materializeRewardItem } from '@shared/contracts/adminRewards';
import {
  DEFAULT_SECRET_REALM_REWARDS,
  SECRET_REALM_ATTRIBUTE_LABELS,
  SecretRealmAttributeSchema,
  SecretRealmRewardsSchema,
  type SecretRealmRewardPreview,
} from '@shared/contracts/secretRealmRewards';
import type {
  ResourceOperation,
  ResourceOperationResult,
} from '@shared/engine/resource/types';
import { itemDefinition, type ItemGrant } from '@shared/inventory';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { grantInventory } from './InventoryService';
import { legacyLibraryInventoryGrant } from './LegacyLibraryInventoryGrant';
import { QiService } from './QiService';
import { resourceEngine } from './resource/ResourceEngine';

export async function compileSecretRealmRewards(
  input: unknown,
  tx?: DbExecutor,
) {
  const rewards = SecretRealmRewardsSchema.parse(
    input ?? DEFAULT_SECRET_REALM_REWARDS,
  );
  const entries = await findPublishedItemLibraryByItemIds(
    rewards.flatMap((r) => (r.type === 'item' ? [r.itemId] : [])),
    tx,
  );
  const operations: ResourceOperation[] = [];
  const inventory: ItemGrant[] = [];
  const previews: SecretRealmRewardPreview[] = [];
  for (const reward of rewards) {
    if (reward.type === 'inventory_v1') {
      // Every admitted run owns its equipment identity; retries reuse the persisted snapshot.
      const grant = materializeRewardItem(reward.inventory, () =>
        crypto.randomUUID(),
      );
      inventory.push(grant);
      const definition = itemDefinition(grant.definitionId);
      previews.push({
        type: reward.type,
        name:
          (grant.instanceData && 'name' in grant.instanceData
            ? grant.instanceData.name
            : undefined) ?? definition.name,
        quantity: grant.quantity,
      });
    } else if (reward.type === 'item') {
      const entry = entries.find((e) => e.itemId === reward.itemId);
      if (!entry) throw new Error('奖励道具不存在或已下架：' + reward.itemId);
      if (entry.type === 'artifact' && reward.quantity > 10)
        throw new Error('单项法宝奖励最多10件');
      for (let remaining = reward.quantity; remaining > 0;) {
        const count = Math.min(remaining, entry.type === 'artifact' ? 1 : 99);
        const grant = legacyLibraryInventoryGrant(
          {
            itemId: entry.itemId,
            type: entry.type,
            payload: entry.payload,
            createdAt: entry.createdAt,
          },
          count,
        );
        inventory.push(materializeRewardItem(grant, () => crypto.randomUUID()));
        remaining -= count;
      }
      previews.push({
        type: entry.type,
        name: entry.name,
        quantity: reward.quantity,
        description: entry.description ?? undefined,
      });
    } else if (reward.type === 'tianling_pill') {
      for (let remaining = reward.quantity; remaining > 0; remaining -= 99) {
        inventory.push({
          definitionId: 'consumable.v1',
          quantity: Math.min(99, remaining),
          instanceData: consumableFactsOf(TIANLING_PILL),
        });
      }
      previews.push({
        type: reward.type,
        name: '天灵丹',
        quantity: reward.quantity,
        description: '服用后补满个人天地灵气。',
      });
    } else if (reward.type === 'attribute') {
      operations.push({
        type: 'attribute',
        value: reward.quantity,
        name: SECRET_REALM_ATTRIBUTE_LABELS[reward.attribute],
        metadata: { attribute: reward.attribute },
      });
      previews.push({
        type: reward.type,
        name: SECRET_REALM_ATTRIBUTE_LABELS[reward.attribute],
        quantity: reward.quantity,
        description: '增加基础属性',
      });
    } else {
      const name = {
        qi: '天地灵气',
        spirit_stones: '灵石',
        cultivation_exp: '修为',
        reputation: '声望',
      }[reward.type];
      operations.push({ type: reward.type, value: reward.quantity, name });
      previews.push({
        type: reward.type,
        name,
        quantity: reward.quantity,
        description:
          reward.type === 'qi'
            ? '按现有天地灵气上限补充，超出部分不再增加。'
            : undefined,
      });
    }
  }
  return { rewards, operations, inventory, previews };
}

// Called only under the existing dungeon/player command transaction and run guard.
export async function applySecretRealmGains(args: {
  userId: string;
  cultivatorId: string;
  gain: ResourceOperation[];
  tx: DbTransaction;
}): Promise<ResourceOperationResult> {
  const [before] = await args.tx
    .select()
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, args.cultivatorId),
        eq(cultivators.userId, args.userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .for('update');
  if (!before) throw new Error('角色不存在或无权限');
  const ordinary: ResourceOperation[] = [];
  const inventory: ItemGrant[] = [];
  for (const operation of args.gain) {
    if (operation.type === 'qi' || operation.type === 'attribute') continue;
    if (
      operation.type === 'consumable' ||
      operation.type === 'material' ||
      operation.type === 'artifact'
    ) {
      const payload = operation.data as Consumable | Material | Artifact;
      if (
        !Number.isSafeInteger(operation.value) ||
        operation.value < 1 ||
        operation.value > 100
      )
        throw new Error('秘境物品奖励数量无效');
      for (let remaining = operation.value; remaining > 0;) {
        const count = Math.min(
          remaining,
          operation.type === 'artifact' ? 1 : 99,
        );
        const grant = legacyLibraryInventoryGrant(
          {
            itemId:
              payload.id ??
              payload.name ??
              operation.name ??
              'secret-realm-legacy',
            type: operation.type,
            payload,
          },
          count,
        );
        inventory.push(materializeRewardItem(grant, () => crypto.randomUUID()));
        remaining -= count;
      }
      continue;
    }
    ordinary.push(operation);
  }
  await grantInventory(args.cultivatorId, inventory, args.tx);
  const result = await resourceEngine.applyInTransaction({
    ...args,
    gain: ordinary,
  });
  if (!result.success)
    throw new Error(result.errors?.join('; ') ?? '奖励发放失败');
  const remaining: Partial<Record<ResourceOperation['type'], number>> = {
    spirit_stones:
      result.settlement!.spiritStones !== undefined
        ? result.settlement!.spiritStones - before.spirit_stones
        : 0,
    reputation:
      result.settlement!.reputation !== undefined
        ? result.settlement!.reputation - (before.reputation ?? 0)
        : 0,
    cultivation_exp: result.settlement!.cultivationProgress
      ? result.settlement!.cultivationProgress.cultivation_exp -
        ((before.cultivation_progress as { cultivation_exp?: number } | null)
          ?.cultivation_exp ?? 0)
      : 0,
  };
  for (const operation of args.gain) {
    if (operation.type in remaining) {
      const actual = Math.max(
        0,
        Math.min(operation.value, remaining[operation.type] ?? 0),
      );
      remaining[operation.type] = (remaining[operation.type] ?? 0) - actual;
      operation.value = actual;
    }
    if (operation.type !== 'qi' && operation.type !== 'attribute') continue;
    if (!Number.isSafeInteger(operation.value) || operation.value < 1)
      throw new Error('秘境奖励数量无效');
    const [row] = await args.tx
      .select()
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, args.cultivatorId),
          eq(cultivators.userId, args.userId),
          eq(cultivators.status, 'active'),
        ),
      )
      .for('update');
    if (!row) throw new Error('角色不存在或无权限');
    if (operation.type === 'qi') {
      if (operation.value > 300) throw new Error('天地灵气奖励超出限制');
      if (row.qi >= QI_OVERFLOW_MAX) {
        result.settlement!.qi = row.qi;
        operation.value = 0;
        continue;
      }
      const restored = await QiService.restoreQi({
        cultivatorId: args.cultivatorId,
        amount: operation.value,
        source: 'compensation',
        actionInstanceId: crypto.randomUUID(),
        metadata: { source: 'secret_realm' },
        tx: args.tx,
      });
      operation.value = restored.restored;
      result.settlement!.qi = restored.qiAfter;
      result.settlement!.qiLastRefreshedAt = restored.qiLastRefreshedAt;
    } else {
      if (operation.value > 1000) throw new Error('属性奖励超出限制');
      const key = SecretRealmAttributeSchema.parse(
        operation.metadata?.attribute,
      );
      const next = row[key] + operation.value;
      if (!Number.isSafeInteger(next) || next > 2_147_483_647)
        throw new Error('属性已达数值上限');
      await args.tx
        .update(cultivators)
        .set({ [key]: next })
        .where(eq(cultivators.id, args.cultivatorId));
      result.settlement!.attributes = {
        ...(result.settlement!.attributes ?? {
          vitality: row.vitality,
          strength: row.strength,
          spirit: row.spirit,
          endurance: row.endurance,
          speed: row.speed,
          willpower: row.willpower,
        }),
        [key]: next,
      };
    }
  }
  return { ...result, operations: args.gain };
}
