import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RATING_TOKEN_STORAGE_KEY,
  applyViewerRating,
  getOrCreateRatingBrowserToken,
  mapPublicEngagementRating,
  parseEngagementRating,
  parseEngagementRatingResponseText,
  type EngagementRatingSummary,
} from "./engagementRatings.ts";

const summary: EngagementRatingSummary = {
  average: 4,
  count: 3,
  guestCount: 1,
  authoredCount: 2,
  histogram: [0, 0, 1, 1, 1],
  viewerRating: 3,
};

test("rating updates replace the browser vote without increasing the aggregate count", () => {
  assert.deepEqual(applyViewerRating(summary, 5), {
    average: 4.666666666666667,
    count: 3,
    guestCount: 1,
    authoredCount: 2,
    histogram: [0, 0, 0, 1, 2],
    viewerRating: 5,
  });
});

test("a browser's first vote extends the guest and unified aggregates", () => {
  const firstVote = applyViewerRating({ ...summary, viewerRating: null, guestCount: 0 }, 2);
  assert.equal(firstVote.count, 4);
  assert.equal(firstVote.guestCount, 1);
  assert.deepEqual(firstVote.histogram, [0, 1, 1, 1, 1]);
  assert.equal(firstVote.average, 3.5);
});

test("rating summaries reject inconsistent backend totals", () => {
  assert.throws(
    () => parseEngagementRating({ ...summary, count: 9 }),
    /inconsistent totals/,
  );
  assert.deepEqual(mapPublicEngagementRating(summary), {
    average: 4,
    count: 3,
    guestCount: 1,
    authoredCount: 2,
    histogram: [0, 0, 1, 1, 1],
  });

});

test("rating responses recover final JSON after legacy server diagnostics", () => {
  const response = `<br><b>Notice</b>: diagnostics must not break REST clients<br>\n${JSON.stringify(summary)}`;
  assert.deepEqual(parseEngagementRatingResponseText(response), summary);
  assert.throws(
    () => parseEngagementRatingResponseText("<br><b>Notice</b>: no JSON response"),
    /malformed JSON/,
  );
});

test("one securely generated browser token is reused without personal data", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const cryptography = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => array,
    randomUUID: () => "12345678-1234-4234-9234-123456789abc" as `${string}-${string}-${string}-${string}-${string}`,
  };
  const first = getOrCreateRatingBrowserToken(storage, cryptography);
  assert.equal(first, "12345678123442349234123456789abc");
  assert.equal(values.get(RATING_TOKEN_STORAGE_KEY), first);
  assert.equal(getOrCreateRatingBrowserToken(storage, cryptography), first);
});

test("standalone component uses native radios and all detail surfaces map it near their titles", async () => {
  const root = new URL("../", import.meta.url);
  const [component, post, community, product] = await Promise.all([
    readFile(new URL("components/GuestStarRating.tsx", root), "utf8"),
    readFile(new URL("pages/PostMockupPage.tsx", root), "utf8"),
    readFile(new URL("pages/CommunityPostMockupPage.tsx", root), "utf8"),
    readFile(new URL("pages/ProductMockupPage.tsx", root), "utf8"),
  ]);
  assert.match(component, /type="radio"/);
  assert.match(component, /<fieldset/);
  assert.match(component, /applyViewerRating/);
  assert.match(component, /setSummary\(previous\)/);
  assert.match(post, /targetType="post"/);
  assert.match(community, /targetType="community_post"/);
  assert.match(product, /targetType="product"/);
  assert.match(product, /averageRating=\{reviewSummary\.averageRating\}/);
  assert.doesNotMatch(product, /totalCountOverride=\{product\.card\.reviewCount/);
});

test("post comments request pagination metadata on the connection", async () => {
  const posts = await readFile(new URL("./posts.ts", import.meta.url), "utf8");
  const query = posts.match(/POST_BY_URI_QUERY = \/\* GraphQL \*\/ `([\s\S]*?)`;/)?.[1] || "";

  assert.match(
    query,
    /comments\(first: 100,[\s\S]*?\n        nodes \{[\s\S]*?\n        \}\n        pageInfo \{ hasNextPage endCursor \}\n      \}/,
  );
});

test("product rating queries use only fields exposed by the shared rating summary schema", async () => {
  const commerce = await readFile(new URL("./commerce.ts", import.meta.url), "utf8");
  const selections = Array.from(commerce.matchAll(/engagementRating\s*\{([^}]*)\}/g), (match) => match[1]);

  assert.ok(selections.length > 0);
  for (const selection of selections) {
    assert.doesNotMatch(selection, /\blanguage\b/);
    assert.match(selection, /\baverage\b/);
    assert.match(selection, /\bcount\b/);
  }
});
