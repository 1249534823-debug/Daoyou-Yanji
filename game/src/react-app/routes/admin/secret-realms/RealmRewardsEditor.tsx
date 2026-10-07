import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { rewardDisplayItem } from '@shared/contracts/adminRewards';
import { AdminButton } from '../_components/AdminButton';
import { ItemLibraryPicker } from '../_components/ItemLibraryPicker';
import { RewardItemPicker } from '../_components/RewardItemPicker';

import {
  SECRET_REALM_ATTRIBUTE_LABELS,
  type SecretRealmReward as RealmReward,
} from '@shared/contracts/secretRealmRewards';
const labels: Record<RealmReward['type'], string> = {
  tianling_pill: '天灵丹',
  qi: '天地灵气',
  spirit_stones: '灵石',
  cultivation_exp: '修为',
  reputation: '声望',
  attribute: '基础属性',
  item: '历史道具库奖励',
  inventory_v1: '道装与道具',
};
const attributes = SECRET_REALM_ATTRIBUTE_LABELS;
const caps = {
  tianling_pill: 100,
  qi: 300,
  spirit_stones: 10_000_000,
  cultivation_exp: 1_000_000,
  reputation: 1_000_000,
  attribute: 1_000,
  item: 100,
  inventory_v1: 99,
};
function realmRewardLabel(reward: RealmReward) {
  if (reward.type === 'inventory_v1')
    return rewardDisplayItem(reward.inventory).name;
  return reward.type === 'attribute'
    ? attributes[reward.attribute]
    : labels[reward.type];
}
function rewardCap(reward: RealmReward) {
  return reward.type === 'inventory_v1' &&
    reward.inventory.definitionId === 'equipment.v6'
    ? 1
    : caps[reward.type];
}

export function RealmRewardsEditor({
  value,
  onChange,
  disabled,
}: {
  value: RealmReward[];
  onChange: (value: RealmReward[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, reward: RealmReward) =>
    onChange(value.map((current, i) => (i === index ? reward : current)));
  return (
    <div className="admin-form-surface space-y-4">
      <p className="text-ink-secondary text-sm">
        每次通关获得以下全部奖励，最多 20
        项。已入场的挑战保留入场时的奖励；新配置对下一次入场生效。
      </p>
      {value.map((reward, index) => (
        <section
          key={index}
          className="admin-readout space-y-4"
          aria-label={`奖励 ${index + 1}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">
              奖励 {index + 1} · {realmRewardLabel(reward)}
            </h3>
            <AdminButton
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              删除
            </AdminButton>
          </div>
          <label className="block space-y-2">
            <span>奖励类型</span>
            <select
              className="w-full"
              value={reward.type}
              disabled={disabled}
              onChange={(e) => {
                const type = e.target.value as RealmReward['type'];
                if (type === 'inventory_v1') return;
                update(
                  index,
                  type === 'item'
                    ? { type, itemId: '', quantity: 1 }
                    : type === 'attribute'
                      ? { type, attribute: 'vitality', quantity: 1 }
                      : { type, quantity: 1 },
                );
              }}
            >
              {Object.entries(labels)
                .filter(
                  ([type]) => type !== 'inventory_v1' || reward.type === type,
                )
                .map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          {reward.type === 'inventory_v1' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid w-24 shrink-0">
                <ItemSlot
                  item={rewardDisplayItem(reward.inventory)}
                  quantityLabel="奖励"
                />
              </div>
              <RewardItemPicker
                label="更换道具"
                disabled={disabled}
                onSelect={(inventory) =>
                  update(index, {
                    type: 'inventory_v1',
                    inventory,
                    quantity: inventory.quantity,
                  })
                }
              />
            </div>
          )}
          {reward.type === 'attribute' && (
            <label className="block space-y-2">
              <span>属性</span>
              <select
                className="w-full"
                value={reward.attribute}
                disabled={disabled}
                onChange={(e) =>
                  update(index, {
                    ...reward,
                    attribute: e.target.value as typeof reward.attribute,
                  })
                }
              >
                {Object.entries(attributes).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {reward.type === 'item' && (
            <ItemLibraryPicker
              value={reward.itemId}
              onChange={(itemId) => update(index, { ...reward, itemId })}
              disabled={disabled}
              includeMaterials
              defaultType="material"
              label="历史道具（原配置保留；新增道装请使用下方道具选择）"
              triggerLabel="选择道具"
            />
          )}
          <label className="block space-y-2">
            <span>{reward.type === 'attribute' ? '增加数值' : '数量'}</span>
            <input
              className="w-full"
              type="number"
              inputMode="numeric"
              min={1}
              max={rewardCap(reward)}
              step={1}
              value={Number.isNaN(reward.quantity) ? '' : reward.quantity}
              disabled={
                disabled ||
                (reward.type === 'inventory_v1' &&
                  reward.inventory.definitionId === 'equipment.v6')
              }
              onChange={(e) => {
                const quantity =
                  e.target.value === '' ? NaN : Number(e.target.value);
                update(
                  index,
                  reward.type === 'inventory_v1'
                    ? {
                        ...reward,
                        quantity,
                        inventory: { ...reward.inventory, quantity },
                      }
                    : { ...reward, quantity },
                );
              }}
            />
          </label>
          <p className="text-ink-secondary text-sm">
            单项上限：{rewardCap(reward).toLocaleString()}
            {reward.type === 'inventory_v1' &&
            reward.inventory.definitionId === 'equipment.v6'
              ? '（道装每项 1 件）'
              : ''}
          </p>
          {reward.type === 'qi' && (
            <p className="text-ink-secondary text-sm">
              增加玩家个人天地灵气，受当前上限限制。
            </p>
          )}
          {reward.type === 'cultivation_exp' && (
            <p className="text-ink-secondary text-sm">
              按当前修为规则增加，不会自动突破境界。
            </p>
          )}
          {reward.type === 'tianling_pill' && (
            <p className="text-ink-secondary text-sm">
              服用后补满个人天地灵气。
            </p>
          )}
        </section>
      ))}
      {value.length === 0 && (
        <p role="status">尚未配置奖励，请至少添加一项。</p>
      )}
      <div className="flex flex-wrap gap-3">
        <RewardItemPicker
          label="＋ 添加道装或道具"
          disabled={disabled || value.length >= 20}
          onSelect={(inventory) =>
            onChange([
              ...value,
              { type: 'inventory_v1', inventory, quantity: inventory.quantity },
            ])
          }
        />
        <AdminButton
          disabled={disabled || value.length >= 20}
          onClick={() =>
            onChange([...value, { type: 'spirit_stones', quantity: 100 }])
          }
        >
          ＋ 添加数值奖励（{value.length}/20）
        </AdminButton>
      </div>
    </div>
  );
}
