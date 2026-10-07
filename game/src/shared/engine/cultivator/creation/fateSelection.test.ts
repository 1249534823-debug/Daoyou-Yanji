import { describe, expect, it } from 'vitest';
import { isValidFateSelection } from './fateSelection';

describe('creation fate selection fairness', () => {
  it.each([
    [0, 1, 2],
    [4, 2, 0],
  ])('accepts three distinct candidates %j', (...indices) => {
    expect(isValidFateSelection(indices, 5)).toBe(true);
  });
  it.each([
    [0, 0, 1],
    [2, 2, 2],
    [0, 1],
    [0, 1, 2, 3],
    [-1, 0, 1],
    [0, 1, 5],
    [0, 1, 1.5],
    [0, 1, NaN],
    [0, 1, Infinity],
    [0, 1, Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid selection %j', (...indices) => {
    expect(isValidFateSelection(indices, 5)).toBe(false);
  });
  it('does not mutate the requested order', () => {
    const indices = [2, 0, 1];
    expect(isValidFateSelection(indices, 3)).toBe(true);
    expect(indices).toEqual([2, 0, 1]);
  });
});
