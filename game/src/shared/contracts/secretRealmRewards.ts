import { RewardItemSchema } from '@shared/contracts/adminRewards';
import { ItemLibraryItemIdSchema } from '@shared/lib/itemLibrary';
import { z } from 'zod';

export const SECRET_REALM_ATTRIBUTE_LABELS = {
  vitality: '体魄',
  strength: '力道',
  spirit: '灵力',
  endurance: '根骨',
  speed: '身法',
  willpower: '神识',
} as const;
export const SecretRealmAttributeSchema = z.enum([
  'vitality',
  'strength',
  'spirit',
  'endurance',
  'speed',
  'willpower',
]);
const quantity = (max: number) => z.number().int().min(1).max(max);
export const SecretRealmRewardSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('inventory_v1'),
      inventory: RewardItemSchema,
      quantity: quantity(99),
    })
    .strict()
    .superRefine((reward, ctx) => {
      if (reward.inventory.quantity !== reward.quantity)
        ctx.addIssue({ code: 'custom', message: '奖励数量必须一致' });
      if (
        reward.inventory.definitionId === 'equipment.v6' &&
        reward.quantity !== 1
      )
        ctx.addIssue({ code: 'custom', message: '单项道装奖励数量必须为1' });
    }),
  z
    .object({ type: z.literal('tianling_pill'), quantity: quantity(100) })
    .strict(),
  z.object({ type: z.literal('qi'), quantity: quantity(300) }).strict(),
  z
    .object({
      type: z.literal('spirit_stones'),
      quantity: quantity(10_000_000),
    })
    .strict(),
  z
    .object({
      type: z.literal('cultivation_exp'),
      quantity: quantity(1_000_000),
    })
    .strict(),
  z
    .object({ type: z.literal('reputation'), quantity: quantity(1_000_000) })
    .strict(),
  z
    .object({
      type: z.literal('attribute'),
      attribute: SecretRealmAttributeSchema,
      quantity: quantity(1000),
    })
    .strict(),
  z
    .object({
      type: z.literal('item'),
      itemId: ItemLibraryItemIdSchema,
      quantity: quantity(100),
    })
    .strict(),
]);
export const SecretRealmRewardsSchema = z
  .array(SecretRealmRewardSchema)
  .min(1)
  .max(20);
export type SecretRealmReward = z.infer<typeof SecretRealmRewardSchema>;
export const DEFAULT_SECRET_REALM_REWARDS: SecretRealmReward[] = [
  { type: 'tianling_pill', quantity: 1 },
];
export interface SecretRealmRewardPreview {
  type: string;
  name: string;
  quantity: number;
  description?: string;
}
