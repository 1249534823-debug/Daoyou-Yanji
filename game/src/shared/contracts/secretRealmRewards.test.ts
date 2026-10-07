import { describe, expect, it } from 'vitest';
import { TIANLING_PILL } from '../config/secretRealmPill';
import { hasClearedTianling } from '../config/secretRealms';
import { consumableFactsOf } from '../items/definitions/consumables';
import {
  DEFAULT_SECRET_REALM_REWARDS,
  SecretRealmRewardsSchema,
} from './secretRealmRewards';
describe('秘境通关奖励配置', () => {
  it('保留天灵丹默认奖励', () =>
    expect(
      SecretRealmRewardsSchema.parse(DEFAULT_SECRET_REALM_REWARDS),
    ).toEqual([{ type: 'tianling_pill', quantity: 1 }]));
  it('允许多类型组合', () =>
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'qi', quantity: 20 },
        { type: 'attribute', attribute: 'vitality', quantity: 2 },
        { type: 'item', itemId: 'herb-01', quantity: 3 },
        { type: 'spirit_stones', quantity: 100 },
      ]).success,
    ).toBe(true));
  it.each([0, -1, 1.5, NaN, Infinity, 10_000_001])('拒绝非法灵石数量 %s', (q) =>
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'spirit_stones', quantity: q },
      ]).success,
    ).toBe(false),
  );
  it('拒绝空列表和超20项', () => {
    expect(SecretRealmRewardsSchema.safeParse([]).success).toBe(false);
    expect(
      SecretRealmRewardsSchema.safeParse(
        Array(21).fill(DEFAULT_SECRET_REALM_REWARDS[0]),
      ).success,
    ).toBe(false);
  });
  it('拒绝衍生属性和任意物品数据', () => {
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'attribute', attribute: 'maxHp', quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'item', itemId: 'x', quantity: 1, data: {} },
      ]).success,
    ).toBe(false);
  });
  it('允许V6道具奖励并拒绝两个数量不一致', () => {
    const inventory = {
      definitionId: 'consumable.v1',
      quantity: 2,
      instanceData: consumableFactsOf(TIANLING_PILL),
    };
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'inventory_v1', inventory, quantity: 2 },
      ]).success,
    ).toBe(true);
    expect(
      SecretRealmRewardsSchema.safeParse([
        { type: 'inventory_v1', inventory, quantity: 3 },
      ]).success,
    ).toBe(false);
    expect(
      SecretRealmRewardsSchema.safeParse([
        {
          type: 'inventory_v1',
          inventory: { ...inventory, quantity: 100 },
          quantity: 100,
        },
      ]).success,
    ).toBe(false);
  });
  it('必须两守卫和首领全部击败', () => {
    expect(hasClearedTianling([1, 3])).toBe(false);
    expect(hasClearedTianling([1, 2])).toBe(false);
    expect(hasClearedTianling([1, 2, 3])).toBe(true);
  });
});
