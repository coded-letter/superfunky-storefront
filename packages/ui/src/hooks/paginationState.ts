export function createPaginationSequenceKey(
  items: ReadonlyArray<{ id: string | number }>,
): string {
  return JSON.stringify(items.map((item) => item.id));
}
