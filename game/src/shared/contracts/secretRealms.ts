import { z } from 'zod';
import { SecretRealmRewardsSchema } from './secretRealmRewards';
export const SecretRealmParamsSchema = z.object({ id: z.literal('tianling') });
export const SecretRealmEnterSchema = z
  .object({ requestId: z.uuid() })
  .strict();
export const SecretRealmClaimSchema = SecretRealmEnterSchema.extend({
  runId: z.uuid(),
}).strict();
export const SecretRealmToggleSchema = z
  .object({
    enabled: z.boolean(),
    version: z.number().int().min(1),
    rewards: SecretRealmRewardsSchema.optional(),
  })
  .strict();
