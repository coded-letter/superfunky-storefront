import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

test("detail queries fetch approved replies and their parent identifiers", async () => {
  const [community, posts, commerce] = await Promise.all([
    source("lib/community.ts"),
    source("lib/posts.ts"),
    source("lib/commerce.ts"),
  ]);

  assert.equal(
    community.match(/comments\(first: 100, where: \{ statusIn: \[APPROVE\] \}\)/g)?.length,
    2,
  );
  assert.doesNotMatch(community, /comments\(first: 100, where: \{ parent: 0/);
  assert.match(posts, /comments\(first: 100, where: \{ statusIn: \[APPROVE\] \}\)/);

  const productDetailQuery = commerce.slice(
    commerce.indexOf("const PRODUCT_DETAIL_QUERY"),
    commerce.indexOf("export async function getCommerceCatalog"),
  );
  assert.match(productDetailQuery, /reviews\(first: 100\)/);

  for (const query of [community, posts, productDetailQuery]) {
    assert.match(query, /\n\s*parentId\n\s*parentDatabaseId\n/);
    assert.match(query, /pageInfo \{ hasNextPage endCursor \}/);
  }

  assert.match(community, /query StorefrontCommunityPostComments\(\$id: ID!, \$after: String\)/);
  assert.match(posts, /query StorefrontPostComments\(\$id: ID!, \$after: String\)/);
  assert.match(commerce, /query StorefrontProductReviews\(\$id: ID!, \$after: String\)/);
  assert.doesNotMatch(
    community,
    /\n            pageInfo \{ hasNextPage endCursor \}\n          \}\n        \}/,
    "community collection pagination belongs on the comments connection, not each Comment node",
  );
});

test("blog and community discussions keep ratings separate from comments", async () => {
  const [postPage, communityPostPage, communityArticlePage] = await Promise.all([
    source("pages/PostMockupPage.tsx"),
    source("pages/CommunityPostMockupPage.tsx"),
    source("pages/CommunityArticleMockupPage.tsx"),
  ]);

  for (const page of [postPage, communityPostPage, communityArticlePage]) {
    assert.match(page, /showRatingField=\{false\}/);
  }
  assert.doesNotMatch(postPage, /Comments and ratings are held/);
  assert.match(postPage, /totalCountOverride=\{post\.comments\.length\}/);
});
