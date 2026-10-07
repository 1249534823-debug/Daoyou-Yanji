import { describe, expect, it } from 'vitest';
import { TIANLING_PILL } from '../config/secretRealmPill';
import { consumableFactsOf } from '../items/definitions/consumables';
import { parseConsumableSpec } from './consumableSpec';

describe('persisted Tianling pill compatibility', () => {
  it('keeps the server-owned qi refill effect through inventory validation', () => {
    const facts = consumableFactsOf(TIANLING_PILL);
    expect(facts.spec).toMatchObject({
      kind: 'pill',
      specialEffect: 'restore_qi_to_max',
      operations: [],
    });
  });
  it('still rejects an ordinary pill without any effect', () => {
    const { specialEffect: _specialEffect, ...ordinary } = TIANLING_PILL.spec;
    expect(() => parseConsumableSpec(ordinary)).toThrow();
  });
  it('rejects unsupported special effects and empty spirit fruits', () => {
    expect(() =>
      parseConsumableSpec({ ...TIANLING_PILL.spec, specialEffect: 'invented' }),
    ).toThrow();
    expect(() =>
      parseConsumableSpec({
        ...TIANLING_PILL.spec,
        kind: 'spirit_fruit',
        source: { kind: 'spirit_field', version: 1 },
      }),
    ).toThrow();
  });
});
