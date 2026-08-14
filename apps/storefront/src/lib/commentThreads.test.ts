import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReviewTree,
  isTopLevelReview,
  mergeServerAndLocalReviews,
} from "./commentThreads.ts";
import type { ProductReview } from "../pages/shared";

const review = (overrides: Partial<ProductReview>): ProductReview => ({
  id: "comment-1",
  databaseId: 1,
  author: "Reader",
  date: "2026-08-07 08:00:00",
  content: "Comment",
  parentId: null,
  parentDatabaseId: 0,
  ...overrides,
});

test("buildReviewTree links replies that arrive before their parent", () => {
  const tree = buildReviewTree([
    review({
      id: "comment-2",
      databaseId: 2,
      parentId: "comment-1",
      parentDatabaseId: 1,
      date: "2026-08-07 09:00:00",
    }),
    review({ id: "comment-1", databaseId: 1 }),
  ]);

  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.id, "comment-1");
  assert.equal(tree[0]?.replies[0]?.id, "comment-2");
});

test("buildReviewTree resolves numeric and database parent identifiers", () => {
  const tree = buildReviewTree([
    review({ id: "relay-parent", databaseId: 43 }),
    review({ id: "relay-child-a", databaseId: 44, parentId: "43", parentDatabaseId: null }),
    review({ id: "relay-child-b", databaseId: 45, parentId: null, parentDatabaseId: 43 }),
  ]);

  assert.deepEqual(tree[0]?.replies.map(({ id }) => id), ["relay-child-a", "relay-child-b"]);
});

test("buildReviewTree promotes unavailable parents and cycles to roots", () => {
  const tree = buildReviewTree([
    review({ id: "orphan", databaseId: 3, parentId: "missing", parentDatabaseId: 999 }),
    review({ id: "cycle-a", databaseId: 4, parentId: "cycle-b" }),
    review({ id: "cycle-b", databaseId: 5, parentId: "cycle-a" }),
  ]);

  assert.deepEqual(tree.map(({ id }) => id), ["cycle-b", "cycle-a", "orphan"]);
});

test("buildReviewTree keeps roots newest-first and replies oldest-first", () => {
  const tree = buildReviewTree([
    review({ id: "new-root", databaseId: 3, date: "2026-08-08 08:00:00" }),
    review({ id: "late-reply", databaseId: 5, parentId: "old-root", date: "2026-08-07 10:00:00" }),
    review({ id: "old-root", databaseId: 1 }),
    review({ id: "early-reply", databaseId: 4, parentId: "old-root", date: "2026-08-07 09:00:00" }),
  ]);

  assert.deepEqual(tree.map(({ id }) => id), ["new-root", "old-root"]);
  assert.deepEqual(tree[1]?.replies.map(({ id }) => id), ["early-reply", "late-reply"]);
});

test("mergeServerAndLocalReviews preserves local submissions without duplicating refreshed nodes", () => {
  const pending = review({ id: "pending-1", databaseId: 0, isPending: true });
  const approved = review({ id: "approved", databaseId: 7 });

  assert.deepEqual(mergeServerAndLocalReviews([approved], [pending]).map(({ id }) => id), [
    "approved",
    "pending-1",
  ]);
  assert.deepEqual(
    mergeServerAndLocalReviews([approved], [review({ id: "stale-local", databaseId: 7 })]).map(({ id }) => id),
    ["approved"],
  );
});

test("isTopLevelReview normalizes zero-valued parent identifiers", () => {
  assert.equal(isTopLevelReview(review({ parentId: "0", parentDatabaseId: 0 })), true);
  assert.equal(isTopLevelReview(review({ parentId: null, parentDatabaseId: 43 })), false);
});
