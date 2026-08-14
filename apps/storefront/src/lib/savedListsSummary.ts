/** Pure validation/normalization helpers for the wishlist/reading-list GraphQL
 * contract — split out from `savedLists.ts` so they have no side-effecting imports
 * (no auth/GraphQL client) and can be unit tested directly, mirroring how
 * `engagementRatings.ts` keeps its own parsing pure. */

export type SavedListType = "wishlist" | "reading_list";

export type SavedListSummary = {
  ids: number[];
  count: number;
  cap: number;
};

/** Validates and normalizes a raw GraphQL `FunkycommerceSavedList` payload. Throws a
 * descriptive error (surfaced as the collection's `syncError`) instead of silently
 * accepting a malformed response. */
export function parseSavedListSummary(value: unknown): SavedListSummary {
  if (!value || typeof value !== "object") throw new Error("The saved list service returned an invalid response");
  const record = value as Record<string, unknown>;
  const ids = record.ids;
  if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || Number(id) <= 0)) {
    throw new Error("The saved list service returned an invalid set of ids");
  }
  const count = record.count;
  if (!Number.isInteger(count) || Number(count) !== ids.length) {
    throw new Error("The saved list service returned an inconsistent count");
  }
  const cap = record.cap;
  if (!Number.isInteger(cap) || Number(cap) < ids.length) {
    throw new Error("The saved list service returned an invalid cap");
  }
  return { ids: ids.map(Number), count: Number(count), cap: Number(cap) };
}

/** Converts the backend's numeric ids to the string ids the shared local
 * `createPersistedIdCollection` abstraction stores and compares against. */
export function savedListIdsToStrings(summary: SavedListSummary): string[] {
  return summary.ids.map(String);
}

/** Resolve current numeric IDs and legacy WPGraphQL Relay IDs persisted by older
 * storefront builds. Invalid local values are ignored during guest-list migration. */
export function stringIdToTargetId(id: string): number | null {
  if (/^[1-9]\d*$/.test(id)) {
    const targetId = Number(id);
    return Number.isSafeInteger(targetId) ? targetId : null;
  }
  try {
    const decoded = atob(id.replace(/-/g, "+").replace(/_/g, "/"));
    const match = decoded.match(/:(\d+)$/);
    const targetId = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(targetId) && targetId > 0 ? targetId : null;
  } catch {
    return null;
  }
}

export function stringIdsToTargetIds(ids: string[]): number[] {
  return [...new Set(ids.map(stringIdToTargetId).filter((id): id is number => id !== null))];
}
