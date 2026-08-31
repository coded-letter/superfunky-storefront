import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ARCHIVE_BATCH_SIZE,
  fetchArchiveNodesInBatches,
  resolveArchivePageSize,
} from "./archiveSettings.ts";

const commerceSource = readFileSync(new URL("./commerce.ts", import.meta.url), "utf8");
const postArchiveSource = readFileSync(new URL("./postArchives.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../pages/PageMockupPage.tsx", import.meta.url), "utf8");
const productArchivePageSource = readFileSync(new URL("../pages/ProductTaxonomyArchivePage.tsx", import.meta.url), "utf8");
const postArchivePageSource = readFileSync(new URL("../pages/PostTaxonomyArchivePage.tsx", import.meta.url), "utf8");
const directorySource = readFileSync(new URL("../pages/ArchiveDirectory.tsx", import.meta.url), "utf8");
const authorSource = readFileSync(new URL("../pages/AuthorMockupPage.tsx", import.meta.url), "utf8");
const communityTagSource = readFileSync(new URL("../pages/CommunityTagArchivePage.tsx", import.meta.url), "utf8");
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");
const socialGridSource = readFileSync(
  new URL("../../../../packages/ui/src/social/SocialFeedGrid.tsx", import.meta.url),
  "utf8",
);

test("archive sizes follow WordPress Reading Settings with safe bounds", () => {
  assert.equal(resolveArchivePageSize(18), 18);
  assert.equal(resolveArchivePageSize(0), 10);
  assert.equal(resolveArchivePageSize(null), 10);
  assert.equal(resolveArchivePageSize(250), 250);
});

test("archive batching loads multiple cursor pages up to the requested total", async () => {
  const calls: { first: number; after: string | null }[] = [];
  const pages = [
    {
      nodes: Array.from({ length: 100 }, (_, index) => index + 1),
      pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
    },
    {
      nodes: Array.from({ length: 100 }, (_, index) => index + 101),
      pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
    },
    {
      nodes: Array.from({ length: 50 }, (_, index) => index + 201),
      pageInfo: { hasNextPage: true, endCursor: "cursor-3" },
    },
  ];
  let pageIndex = 0;

  const result = await fetchArchiveNodesInBatches(250, async (first, after) => {
    calls.push({ first, after });
    return pages[pageIndex++]!;
  });

  assert.equal(result.nodes.length, 250);
  assert.equal(result.hasMore, true);
  assert.deepEqual(calls, [
    { first: ARCHIVE_BATCH_SIZE, after: null },
    { first: ARCHIVE_BATCH_SIZE, after: "cursor-1" },
    { first: 50, after: "cursor-2" },
  ]);
});

test("archive batching rejects incomplete cursors", async () => {
  await assert.rejects(
    fetchArchiveNodesInBatches(150, async () => ({
      nodes: Array.from({ length: 100 }, (_, index) => index + 1),
      pageInfo: { hasNextPage: true, endCursor: null },
    })),
    /incomplete pagination cursor/,
  );
});

test("taxonomy archives batch backend pagination and remain publicly indexable", () => {
  assert.match(postArchiveSource, /posts\(first:\s*\$first,\s*after:\s*\$after\)/);
  assert.match(postArchiveSource, /pageInfo\s*\{\s*hasNextPage\s*endCursor\s*\}/);
  assert.match(postArchiveSource, /fetchArchiveNodesInBatches<RawBlogPost>\(/);

  assert.match(commerceSource, /function archiveQuery[\s\S]*?localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:/);
  assert.match(commerceSource, /function compatibleArchiveQuery[\s\S]*?products\(first:\s*\$first,\s*after:\s*\$after\)/);
  assert.match(commerceSource, /function compatibleLocalizedBrandArchiveQuery[\s\S]*?localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:/);
  assert.match(commerceSource, /pageInfo\s*\{\s*hasNextPage\s*endCursor\s*\}/);
  assert.match(commerceSource, /fetchArchiveNodesInBatches<RawProductCard>\(/);

  assert.match(commerceSource, /robots: "index, follow"/);
  assert.match(postArchiveSource, /robots: "index, follow"/);
  assert.match(pageSource, /robots=\{routeKey && PUBLIC_APPLICATION_ROUTES\.has\(routeKey\) \? "index, follow"/);
  assert.match(productArchivePageSource, /robots="index, follow"/);
  assert.match(postArchivePageSource, /robots="index, follow"/);
  assert.match(directorySource, /robots="index, follow"/);
  assert.match(authorSource, /robots="index, follow"/);
  assert.match(communityTagSource, /robots="index, follow"/);
  assert.match(prerenderSource, /robots: route\.robots,\s*indexable: route\.indexable/);
  assert.doesNotMatch(prerenderSource, /preserveCmsRobots/);
});

test("multi-column community cards stretch across their grid cells", () => {
  assert.match(socialGridSource, /flex h-full w-full items-stretch justify-center/);
});
