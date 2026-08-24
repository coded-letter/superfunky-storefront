import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseSavedListSummary,
  savedListIdsToStrings,
  stringIdToTargetId,
  stringIdsToTargetIds,
  type SavedListSummary,
} from "./savedListsSummary.ts";
import { SavedListSyncState, savedListEntityId } from "../../../../packages/ui/src/state/savedListSync.ts";

const summary: SavedListSummary = { ids: [3, 1, 2], count: 3, cap: 300 };

test("saved list summaries validate ids, count, and cap consistency", () => {
  assert.deepEqual(parseSavedListSummary(summary), summary);
  assert.throws(() => parseSavedListSummary(null), /invalid response/);
  assert.throws(() => parseSavedListSummary({ ids: [0, 1], count: 2, cap: 10 }), /invalid set of ids/);
  assert.throws(() => parseSavedListSummary({ ids: [1, 2], count: 3, cap: 10 }), /inconsistent count/);
  assert.throws(() => parseSavedListSummary({ ids: [1, 2, 3], count: 3, cap: 2 }), /invalid cap/);
});

test("saved list ids round-trip between the backend's numeric ids and the shared local string-id collection", () => {
  assert.deepEqual(savedListIdsToStrings(summary), ["3", "1", "2"]);
  const legacyRelayId = Buffer.from("post:42").toString("base64");
  assert.equal(stringIdToTargetId(legacyRelayId), 42);
  assert.equal(stringIdToTargetId("12junk"), null);
  assert.deepEqual(stringIdsToTargetIds(["3", legacyRelayId, "not-a-number", "0", "-2", "3"]), [3, 42]);
});

test("saved-list UI identity prefers backend database IDs over Relay node IDs", () => {
  assert.equal(savedListEntityId({ id: "cHJvZHVjdDoxMjM=", databaseId: 123 }), "123");
  assert.equal(savedListEntityId({ id: "guest-product" }), "guest-product");
});

test("wishlist and reading-list surfaces compare the same database IDs returned by the backend", () => {
  const productCard = readFileSync(new URL("../../../../packages/ui/src/catalog/ProductCard.tsx", import.meta.url), "utf8");
  const postCard = readFileSync(new URL("../../../../packages/ui/src/blog/PostCard.tsx", import.meta.url), "utf8");
  const wishlistPage = readFileSync(new URL("../pages/WishlistMockupPage.tsx", import.meta.url), "utf8");
  const readingListPage = readFileSync(new URL("../pages/ReadingListMockupPage.tsx", import.meta.url), "utf8");
  const postArchive = readFileSync(new URL("./postArchives.ts", import.meta.url), "utf8");

  assert.match(productCard, /const wishlistId = savedListEntityId\(product\)/);
  assert.match(postCard, /PostBookmarkButton postId=\{savedListEntityId\(post\)\}/);
  assert.match(wishlistPage, /ids\.includes\(savedListEntityId\(product\)\)/);
  assert.match(readingListPage, /new Map\(\(blog\?\.posts \|\| \[\]\)\.map\(\(post\) => \[savedListEntityId\(post\), post\]\)\)/);
  assert.match(postArchive, /translations \{\s*id\s*databaseId/s);
  assert.match(postArchive, /translations\[code\] = String\(translation\.databaseId\)/);
});

test("optimistic saved-list coordination retains later actions while earlier requests settle or fail", () => {
  const state = new SavedListSyncState();
  state.reset(["1"]);
  const addTwo = state.toggle("2");
  const addThree = state.toggle("3");
  assert.deepEqual(state.ids, ["1", "2", "3"]);

  // The first response is authoritative only up to its own revision. The later
  // optimistic click remains applied rather than being overwritten by this snapshot.
  state.resolve(addTwo, ["1", "2"]);
  assert.deepEqual(state.ids, ["1", "2", "3"]);
  state.resolve(addThree, ["1", "2", "3"]);
  assert.deepEqual(state.ids, ["1", "2", "3"]);

  const clear = state.clear();
  const addFour = state.toggle("4");
  assert.deepEqual(state.ids, ["4"]);
  state.reject(clear);
  assert.deepEqual(state.ids, ["1", "2", "3", "4"]);

  // Resetting for a new scope restores only the supplied guest ids, never the
  // prior account's authoritative snapshot.
  state.reset(["guest-only"]);
  assert.deepEqual(state.ids, ["guest-only"]);
});

test("the shared collection keeps guest state separate from account-scoped authoritative state", () => {
  const collection = readFileSync(new URL("../../../../packages/ui/src/state/createPersistedIdCollection.tsx", import.meta.url), "utf8");
  assert.match(collection, /PersistedIdCollectionRemote/);
  assert.match(collection, /mergeGuestIds/);
  assert.match(collection, /toggleId/);
  assert.match(collection, /clearIds/);
  assert.match(collection, /accountId\?: string \| number \| null/);
  assert.match(collection, /guestIds/);
  assert.match(collection, /guestIdsRef\.current = \[\]/);
  assert.match(collection, /queueRef/);
  assert.match(collection, /SavedListSyncState/);
  assert.match(collection, /isSyncing/);
  assert.match(collection, /syncError/);
});

test("AppStateProvider forwards account identity and remote adapters to the wishlist/reading-list collections only", () => {
  const provider = readFileSync(new URL("../../../../packages/ui/src/state/AppStateProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /accountId\?: string \| number \| null/);
  assert.match(provider, /wishlistRemote\?: PersistedIdCollectionRemote/);
  assert.match(provider, /readingListRemote\?: PersistedIdCollectionRemote/);
  assert.match(provider, /<WishlistProvider accountId=\{accountId\} remote=\{wishlistRemote\}>/);
  assert.match(provider, /<ReadingListProvider accountId=\{accountId\} remote=\{readingListRemote\}>/);
  // Tag interests / read articles remain guest-local only, matching the roadmap's scope.
  assert.doesNotMatch(provider, /<TagInterestsProvider isAuthenticated/);
  assert.doesNotMatch(provider, /<ReadArticlesProvider isAuthenticated/);
});

test("the storefront app wires stable account identity and GraphQL adapters into AppStateProvider", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /useAuthenticatedAccountId/);
  assert.match(app, /readingListRemote, wishlistRemote/);
  assert.match(app, /accountId=\{accountId\}/);
  assert.match(app, /wishlistRemote=\{wishlistRemote\}/);
  assert.match(app, /readingListRemote=\{readingListRemote\}/);
});

test("backend GraphQL contract exposes independent wishlist and reading-list mutations with validation, dedup, caps, and order", () => {
  const backend = readFileSync(
    new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/saved-lists.php", import.meta.url),
    "utf8",
  );
  // Independent contracts per list.
  assert.match(backend, /toggleWishlistItem/);
  assert.match(backend, /toggleReadingListItem/);
  assert.match(backend, /clearWishlist/);
  assert.match(backend, /clearReadingList/);
  assert.match(backend, /mergeWishlist/);
  assert.match(backend, /mergeReadingList/);
  // Validation.
  assert.match(backend, /funkycommerce_validate_saved_list_target/);
  assert.match(backend, /'publish' !== \$target->post_status/);
  // Deduplication.
  assert.match(backend, /UNIQUE KEY user_list_target/);
  assert.match(backend, /INSERT IGNORE/);
  // Caps.
  assert.match(backend, /funkycommerce_saved_list_cap/);
  assert.match(backend, /funkycommerce_saved_list_cap_reached/);
  // Order (insertion order preserved for both guest-merge and normal reads).
  assert.match(backend, /ORDER BY id ASC/);
  // Guest/remote merge on login.
  assert.match(backend, /funkycommerce_merge_saved_list/);
  assert.match(backend, /acceptedIds/);
  assert.match(backend, /droppedIds/);
  // Capability-protected aggregate and per-user admin views.
  assert.match(backend, /funkycommerceSavedListsInterestSummary/);
  assert.match(backend, /funkycommerceUserSavedLists/);
  assert.match(backend, /funkycommerce_require_saved_list_admin/);
  assert.match(backend, /current_user_can\( 'manage_woocommerce' \) && ! current_user_can\( 'manage_options' \)/);
  assert.match(backend, /current_user_can\( 'edit_user', \$target_user_id \)/);
  assert.match(backend, /funkycommerce_add_saved_lists_admin_page/);
  assert.match(backend, /funkycommerce_render_saved_lists_admin_page/);
  assert.match(backend, /funkycommerce_render_saved_list_interest_overview/);
  assert.match(backend, /funkycommerce_render_saved_list_admin_targets/);
});

test("the frontend saved-list adapters match the shared PersistedIdCollectionRemote contract", () => {
  const client = readFileSync(new URL("./savedLists.ts", import.meta.url), "utf8");
  assert.match(client, /export const wishlistRemote: PersistedIdCollectionRemote/);
  assert.match(client, /export const readingListRemote: PersistedIdCollectionRemote/);
  assert.match(client, /mergeGuestIds\(guestIds\)/);
  assert.match(client, /async toggleId\(id\)/);
  assert.match(client, /async clearIds\(\)/);
  assert.match(client, /getAuthTokenForRequest/);
  assert.match(client, /toggleWishlistItem.*clearWishlist.*mergeWishlist/s);
  assert.match(client, /\$\{mutationName\}\(input: \{\}\)/);
});

test("wishlist and reading-list mockup pages surface syncError and the authenticated cap", () => {
  const wishlistPage = readFileSync(new URL("../pages/WishlistMockupPage.tsx", import.meta.url), "utf8");
  const readingListPage = readFileSync(new URL("../pages/ReadingListMockupPage.tsx", import.meta.url), "utf8");
  for (const [namespace, page] of [["wishlist", wishlistPage], ["reading_list", readingListPage]]) {
    assert.match(page, /syncError/);
    assert.match(page, /capError/);
    assert.match(page, /useSavedListCap/);
    assert.match(page, new RegExp(`t\\("${namespace}\\.sync_synced"\\)`));
    assert.match(page, new RegExp(`t\\("${namespace}\\.sync_local"\\)`));
  }
});

test("the header reflects wishlist/reading-list sync errors from the shared collection abstraction", () => {
  const header = readFileSync(new URL("../../../../packages/ui/src/layout/HeaderMockup.tsx", import.meta.url), "utf8");
  assert.match(header, /wishlistSyncError/);
  assert.match(header, /readingListSyncError/);
  assert.match(header, /SyncErrorDot/);
});
