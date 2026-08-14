/** Authenticated wishlist and reading-list GraphQL contract — the backend counterpart
 * of `backend/wordpress/themes/free/funkycommerce-headless/inc/saved-lists.php`.
 *
 * Both lists share one validated/deduplicated/capped/ordered storage on the backend
 * and one thin request layer here, but are exposed as two independent sets of
 * mutations (`toggleWishlistItem`/`toggleReadingListItem`, etc.) so each can be
 * queried, toggled, cleared, or merged on its own from the storefront.
 *
 * The exported `wishlistRemote`/`readingListRemote` adapters match the shared
 * `PersistedIdCollectionRemote` contract from `@funky/ui`'s
 * `createPersistedIdCollection`, so the collection Provider can merge guest ids on
 * login and keep later toggles/clears synchronized (with rollback on failure)
 * without `@funky/ui` needing to know anything about GraphQL or auth tokens. */

import { useEffect, useState } from "react";
import type { PersistedIdCollectionRemote } from "@funky/ui";
import { getAuthTokenForRequest, useIsUserLoggedIn } from "./auth.ts";
import { graphqlRequest } from "@funky/sdk";
import {
  parseSavedListSummary,
  savedListIdsToStrings,
  stringIdToTargetId,
  stringIdsToTargetIds,
  type SavedListSummary,
  type SavedListType,
} from "./savedListsSummary.ts";

export type { SavedListSummary, SavedListType } from "./savedListsSummary.ts";
export { parseSavedListSummary, savedListIdsToStrings } from "./savedListsSummary.ts";

const SAVED_LIST_FIELDS = /* GraphQL */ `
  ids
  count
  cap
`;

const SAVED_LIST_MUTATION_NAMES: Record<SavedListType, { toggle: string; clear: string; merge: string }> = {
  wishlist: { toggle: "toggleWishlistItem", clear: "clearWishlist", merge: "mergeWishlist" },
  reading_list: { toggle: "toggleReadingListItem", clear: "clearReadingList", merge: "mergeReadingList" },
};

async function runSavedListRequest<T>(query: string, variables: Record<string, unknown> | undefined): Promise<T> {
  const token = await getAuthTokenForRequest();
  if (!token) throw new Error("Sign in to sync this saved list");
  const { data, errors } = await graphqlRequest<T>(query, variables, token);
  if (errors?.length || !data) {
    throw new Error(errors?.map(({ message }) => message).join("; ") || "The saved list request failed");
  }
  return data;
}

export async function fetchSavedListSummary(listType: SavedListType): Promise<SavedListSummary> {
  const field = listType === "wishlist" ? "wishlist" : "readingList";
  const data = await runSavedListRequest<{ funkycommerceAccount: Record<string, unknown> | null }>(
    `query StorefrontSavedList { funkycommerceAccount { ${field} { ${SAVED_LIST_FIELDS} } } }`,
    undefined,
  );
  if (!data.funkycommerceAccount) throw new Error("Your account could not be loaded");
  return parseSavedListSummary(data.funkycommerceAccount[field]);
}

/** Fetches the signed-in user's cap for one saved list. Failures are returned for the
 * page to display: hiding an authenticated failure as a guest-local list is unsafe. */
export function useSavedListCap(listType: SavedListType): { cap: number | null; error: string | null; isLoggedIn: boolean } {
  const isLoggedIn = useIsUserLoggedIn();
  const [cap, setCap] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setCap(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    fetchSavedListSummary(listType)
      .then((summary) => {
        if (!cancelled) setCap(summary.cap);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setCap(null);
          setError(fetchError instanceof Error ? fetchError.message : "Your saved-list limit could not be loaded");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, listType]);

  return { cap, error, isLoggedIn };
}

export async function toggleSavedListItem(listType: SavedListType, targetId: number): Promise<SavedListSummary> {
  const mutationName = SAVED_LIST_MUTATION_NAMES[listType].toggle;
  const data = await runSavedListRequest<Record<string, { active: boolean; list: Record<string, unknown> } | null>>(
    `mutation StorefrontToggleSavedListItem($targetId: Int!) {
      ${mutationName}(input: { targetId: $targetId }) { active list { ${SAVED_LIST_FIELDS} } }
    }`,
    { targetId },
  );
  const result = data[mutationName];
  if (!result) throw new Error("The saved list item could not be toggled");
  return parseSavedListSummary(result.list);
}

export async function clearSavedList(listType: SavedListType): Promise<SavedListSummary> {
  const mutationName = SAVED_LIST_MUTATION_NAMES[listType].clear;
  const data = await runSavedListRequest<Record<string, { list: Record<string, unknown> } | null>>(
    `mutation StorefrontClearSavedList {
      ${mutationName}(input: {}) { list { ${SAVED_LIST_FIELDS} } }
    }`,
    undefined,
  );
  const result = data[mutationName];
  if (!result) throw new Error("The saved list could not be cleared");
  return parseSavedListSummary(result.list);
}

export type SavedListMergeResult = {
  summary: SavedListSummary;
  acceptedIds: number[];
  droppedIds: number[];
};

export async function mergeSavedList(listType: SavedListType, guestTargetIds: number[]): Promise<SavedListMergeResult> {
  const mutationName = SAVED_LIST_MUTATION_NAMES[listType].merge;
  const data = await runSavedListRequest<Record<string, { list: Record<string, unknown>; acceptedIds: unknown; droppedIds: unknown } | null>>(
    `mutation StorefrontMergeSavedList($ids: [Int!]!) {
      ${mutationName}(input: { ids: $ids }) { list { ${SAVED_LIST_FIELDS} } acceptedIds droppedIds }
    }`,
    { ids: guestTargetIds },
  );
  const result = data[mutationName];
  if (!result) throw new Error("The saved list could not be merged");
  const acceptedIds = Array.isArray(result.acceptedIds) ? result.acceptedIds.map(Number) : [];
  const droppedIds = Array.isArray(result.droppedIds) ? result.droppedIds.map(Number) : [];
  return { summary: parseSavedListSummary(result.list), acceptedIds, droppedIds };
}

/** Builds a `PersistedIdCollectionRemote` adapter (from `@funky/ui`) for one saved
 * list — the bridge between the shared guest-local collection abstraction and this
 * app's real GraphQL contract. Any GraphQL/network failure propagates as a rejected
 * promise so the collection can roll its optimistic local change back and surface
 * `syncError`. */
function createSavedListRemote(listType: SavedListType): PersistedIdCollectionRemote {
  return {
    async mergeGuestIds(guestIds) {
      const targetIds = stringIdsToTargetIds(guestIds);
      const { summary } = await mergeSavedList(listType, targetIds);
      return savedListIdsToStrings(summary);
    },
    async toggleId(id) {
      const targetId = stringIdToTargetId(id);
      if (!targetId) throw new Error("A valid item is required");
      const summary = await toggleSavedListItem(listType, targetId);
      return savedListIdsToStrings(summary);
    },
    async clearIds() {
      const summary = await clearSavedList(listType);
      return savedListIdsToStrings(summary);
    },
  };
}

export const wishlistRemote: PersistedIdCollectionRemote = createSavedListRemote("wishlist");
export const readingListRemote: PersistedIdCollectionRemote = createSavedListRemote("reading_list");
