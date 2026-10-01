export function createPaginationSequenceKey(
  items: ReadonlyArray<{ id: string | number }>,
): string {
  return JSON.stringify(items.map((item) => item.id));
}

export function resolveGridPageSize(value: number | undefined, itemCount: number, fallback: number): number {
  if (value === -1) return Math.max(1, itemCount);
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
