const MAX_COLLECTION_OFFSET = 1_000_000;

export function parseCollectionOffset(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed)
    ? Math.min(MAX_COLLECTION_OFFSET, Math.max(0, parsed))
    : 0;
}

export function withCollectionOffset<T>(
  items: readonly T[],
  value: string | undefined,
  limit?: number,
): T[] {
  const offset = parseCollectionOffset(value);
  return items.slice(offset, limit === undefined ? undefined : offset + limit);
}
