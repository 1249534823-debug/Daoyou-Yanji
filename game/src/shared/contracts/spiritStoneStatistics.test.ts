import { describe, expect, it } from 'vitest';
import {
  beijingDate,
  SpiritStoneDailyQuerySchema,
  SpiritStoneLedgerQuerySchema,
} from './spiritStoneStatistics';
describe('spirit stone daily calendar and query contracts', () => {
  it.each([
    ['2026-09-11T15:59:59Z', '2026-09-11'],
    ['2026-09-11T16:00:00Z', '2026-09-12'],
    ['2026-12-31T16:00:00Z', '2027-01-01'],
  ])('Beijing calendar %s', (input, expected) =>
    expect(beijingDate(new Date(input))).toBe(expected),
  );
  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-9-1',
    'abc',
  ])('rejects invalid date %s', (date) =>
    expect(SpiritStoneDailyQuerySchema.safeParse({ date }).success).toBe(false),
  );
  it('accepts leap day and explicit paging', () =>
    expect(
      SpiritStoneDailyQuerySchema.parse({
        date: '2028-02-29',
        page: '2',
        pageSize: '50',
        q: ' 道友 ',
      }),
    ).toEqual({ date: '2028-02-29', page: 2, pageSize: 50, q: '道友' }));
  it.each([
    { page: 0 },
    { pageSize: 101 },
    { page: 1.5 },
    { q: '字'.repeat(101) },
  ])('rejects invalid bounds', (bad) =>
    expect(
      SpiritStoneDailyQuerySchema.safeParse({ date: '2026-09-11', ...bad })
        .success,
    ).toBe(false),
  );
  it('requires valid selected identity', () =>
    expect(
      SpiritStoneLedgerQuerySchema.safeParse({
        date: '2026-09-11',
        cultivatorId: 'wrong',
      }).success,
    ).toBe(false));
});
