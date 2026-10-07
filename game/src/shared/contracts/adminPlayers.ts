import { z } from 'zod';

export const AdminPlayerSearchQuerySchema = z
  .object({ q: z.string().trim().min(1).max(100) })
  .strict();

export type AdminPlayerSearchQuery = z.infer<
  typeof AdminPlayerSearchQuerySchema
>;
export interface AdminPlayerSearchItem {
  id: string;
  name: string;
  realm: string;
  stage: string;
}
