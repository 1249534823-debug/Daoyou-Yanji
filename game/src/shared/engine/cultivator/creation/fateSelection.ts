/** Exactly three distinct candidates; never silently discard invalid selections. */
export function isValidFateSelection(
  indices: readonly number[],
  poolSize = Number.MAX_SAFE_INTEGER,
): boolean {
  return (
    indices.length === 3 &&
    new Set(indices).size === 3 &&
    indices.every(
      (index) => Number.isSafeInteger(index) && index >= 0 && index < poolSize,
    )
  );
}
