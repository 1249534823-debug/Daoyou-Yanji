import { z } from 'zod';

export function beijingDate(value: Date = new Date()): string {
  return new Date(value.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00+08:00');
    return Number.isFinite(parsed.getTime()) && beijingDate(parsed) === value;
  }, '日期无效');
export const SpiritStoneDailyQuerySchema = z.object({
  date: dateSchema.default(() => beijingDate()),
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const SpiritStoneLedgerQuerySchema = SpiritStoneDailyQuerySchema.omit({
  q: true,
}).extend({ cultivatorId: z.string().uuid() });
export type SpiritStoneDailyQuery = z.infer<typeof SpiritStoneDailyQuerySchema>;
export type SpiritStoneLedgerQuery = z.infer<
  typeof SpiritStoneLedgerQuerySchema
>;
export type SpiritStonePlayer = {
  cultivatorId: string;
  name: string;
  realm: string;
  stage: string;
  status: string;
  deleted: boolean;
  currentBalance: number | null;
};
export type SpiritStoneStatisticsMeta = {
  date: string;
  timezone: 'Asia/Shanghai';
  trackingStartedAt: string;
  partialDay: boolean;
  page: number;
  pageSize: number;
  total: number;
};
export type SpiritStoneDailyResult = SpiritStoneStatisticsMeta & {
  summary: {
    income: string;
    expense: string;
    net: string;
    transactionCount: number;
    activePlayers: number;
  };
  players: Array<
    SpiritStonePlayer & {
      income: string;
      expense: string;
      net: string;
      transactionCount: number;
    }
  >;
};
export type SpiritStoneLedgerResult = SpiritStoneStatisticsMeta & {
  player: SpiritStonePlayer | null;
  entries: Array<{
    id: string;
    occurredAt: string;
    source: string;
    sourceLabel: string;
    delta: number;
    balanceBefore: number;
    balanceAfter: number;
  }>;
};
