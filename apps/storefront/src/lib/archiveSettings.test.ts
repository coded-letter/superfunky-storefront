import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GraphqlResponse } from "@funky/sdk";
import {
  ARCHIVE_BATCH_SIZE,
  fetchArchiveNodesInBatches,
  fetchRestArchiveNodes,
  getArchiveSettings,
  resolveArchivePageSize,
} from "./archiveSettings.ts";
import type { GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";

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
  assert.equal(resolveArchivePageSize(-1), -1);
});

function responseRequester(responses: unknown[]): GraphqlFieldFallbackRequester {
  return async <T>() => {
    assert.ok(responses.length, "unexpected settings request");
    return responses.shift() as GraphqlResponse<T>;
  };
}

test("native settings keep post and Woo page sizes independent, including unlimited and above 100", async () => {
  for (const settings of [
    { postsPerPage: 7, productsPerPage: 24 },
    { postsPerPage: 250, productsPerPage: -1 },
    { postsPerPage: -1, productsPerPage: 150 },
  ]) {
    const result = await getArchiveSettings(responseRequester([{ data: { funkycommerceArchiveSettings: settings } }]));
    assert.deepEqual(result, settings);
  }
});

test("legacy compatibility is limited to the missing archive settings field", async (context) => {
  const warning = context.mock.method(console, "warn", () => {});
  const result = await getArchiveSettings(responseRequester([
    { errors: [{ message: 'Cannot query field "funkycommerceArchiveSettings" on type "RootQuery".' }] },
    { data: { readingSettings: { postsPerPage: 17 } } },
  ]));
  assert.deepEqual(result, { postsPerPage: 17, productsPerPage: 12 });
  assert.equal(warning.mock.callCount(), 1);

  await assert.rejects(getArchiveSettings(responseRequester([
    { errors: [{ message: "Settings access denied" }] },
  ])), /Settings access denied/);
  await assert.rejects(getArchiveSettings(async () => { throw new Error("Network offline"); }), /Network offline/);
});

test("invalid or absent settings fail explicitly rather than returning a success-shaped default", async () => {
  for (const value of [null, 0, -2, 1.5, "12"]) {
    await assert.rejects(getArchiveSettings(responseRequester([
      { data: { funkycommerceArchiveSettings: { postsPerPage: value, productsPerPage: 12 } } },
    ])), /invalid archive pagination settings/);
  }
  await assert.rejects(getArchiveSettings(responseRequester([{ data: null }])), /invalid archive pagination settings/);
});

test("complete archives retain every item beyond the first visual and transport pages", async () => {
  const calls: Array<[number, string | null]> = [];
  const result = await fetchArchiveNodesInBatches(-1, async (first, after) => {
    calls.push([first, after]);
    const start = after ? Number(after) : 0;
    const end = Math.min(237, start + first);
    return {
      nodes: Array.from({ length: end - start }, (_, index) => start + index),
      pageInfo: { hasNextPage: end < 237, endCursor: String(end) },
    };
  });
  assert.equal(result.nodes.length, 237);
  assert.equal(result.nodes.at(-1), 236);
  assert.equal(result.hasMore, false);
  assert.equal(ARCHIVE_BATCH_SIZE, 25);
  assert.deepEqual(calls, Array.from({ length: 10 }, (_, index) =>
    [25, index === 0 ? null : String(index * 25)]));
});

test("archive batching rejects cursor cycles instead of looping or showing duplicate pages", async () => {
  await assert.rejects(fetchArchiveNodesInBatches(-1, async () => ({
    nodes: [1], pageInfo: { hasNextPage: true, endCursor: "same" },
  })), /repeated a pagination cursor/);
});

test("Store API pagination follows all total-pages headers, including short filtered batches", async () => {
  const calls: string[] = [];
  const nodes = await fetchRestArchiveNodes<number>("https://cms.test/wp-json/wc/store/v1/products", async (input) => {
    const url = new URL(String(input));
    calls.push(url.search);
    return new Response(JSON.stringify([Number(url.searchParams.get("page"))]), {
      headers: { "x-wp-totalpages": "3" },
    });
  });
  assert.deepEqual(nodes, [1, 2, 3]);
  assert.deepEqual(calls, ["?per_page=100&page=1", "?per_page=100&page=2", "?per_page=100&page=3"]);
});

test("Store API pagination accepts empty catalogs and unavailable Woo, but not partial or failed pages", async () => {
  assert.deepEqual(await fetchRestArchiveNodes("https://cms.test/products", async () =>
    new Response("[]", { headers: { "x-wp-totalpages": "0" } })), []);
  assert.deepEqual(await fetchRestArchiveNodes("https://cms.test/products", async () =>
    new Response(null, { status: 404 })), []);
  for (const response of [
    new Response("[]"),
    new Response("[]", { headers: { "x-wp-totalpages": "2" } }),
    new Response("{}", { headers: { "x-wp-totalpages": "1" } }),
    new Response(null, { status: 500 }),
  ]) {
    await assert.rejects(fetchRestArchiveNodes("https://cms.test/products", async () => response), /WooCommerce Store API/);
  }
});

test("archive batching loads multiple cursor pages up to the requested total", async () => {
  const calls: { first: number; after: string | null }[] = [];
  const pages = [
    {
      nodes: Array.from({ length: 25 }, (_, index) => index + 1),
      pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
    },
    {
      nodes: Array.from({ length: 25 }, (_, index) => index + 26),
      pageInfo: { hasNextPage: true, endCursor: "cursor-2" },
    },
    {
      nodes: Array.from({ length: 10 }, (_, index) => index + 51),
      pageInfo: { hasNextPage: true, endCursor: "cursor-3" },
    },
  ];
  let pageIndex = 0;

  const result = await fetchArchiveNodesInBatches(60, async (first, after) => {
    calls.push({ first, after });
    return pages[pageIndex++]!;
  });

  assert.equal(result.nodes.length, 60);
  assert.equal(result.hasMore, true);
  assert.deepEqual(calls, [
    { first: ARCHIVE_BATCH_SIZE, after: null },
    { first: ARCHIVE_BATCH_SIZE, after: "cursor-1" },
    { first: 10, after: "cursor-2" },
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

test("archive batching accepts an empty terminal page from filtered WPGraphQL connections", async () => {
  const result = await fetchArchiveNodesInBatches(10, async () => ({
    nodes: [],
    pageInfo: { hasNextPage: true, endCursor: null },
  }));

  assert.deepEqual(result, { nodes: [], hasMore: false });
});

test("taxonomy archives batch backend pagination and remain publicly indexable", () => {
  assert.match(postArchiveSource, /posts\(first:\s*\$first,\s*after:\s*\$after\)/);
  assert.match(postArchiveSource, /pageInfo\s*\{\s*hasNextPage\s*endCursor\s*\}/);
  assert.match(postArchiveSource, /fetchArchiveNodesInBatches<RawBlogPost>\(/);

  assert.match(commerceSource, /function archiveQuery[\s\S]*?localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:/);
  assert.match(commerceSource, /function archiveQuery[\s\S]*?archive:[\s\S]*?products\(first:\s*\$first,\s*after:\s*\$after\)/);
  assert.match(commerceSource, /function compatibleArchiveQuery[\s\S]*?products\(first:\s*\$first,\s*after:\s*\$after\)/);
  assert.match(commerceSource, /function compatibleLocalizedBrandArchiveQuery[\s\S]*?localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:/);
  assert.match(commerceSource, /pageInfo\s*\{\s*hasNextPage\s*endCursor\s*\}/);
  assert.match(commerceSource, /fetchArchiveNodesInBatches<RawProductCard>\(/);
  assert.match(commerceSource, /useLocalizedProducts = Boolean\(initialData\.localizedProducts\?\.nodes\.length\)/);
  assert.match(commerceSource, /useLocalizedProducts\s*\? pageData\.localizedProducts\s*: pageData\.archive\?\.products/);

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

test("native defaults reach archive grids and build-time hydration without hard-coded page sizes", () => {
  for (const source of [productArchivePageSource, postArchivePageSource, authorSource]) {
    assert.doesNotMatch(source, /pageSize=\{\d+\}/);
  }
  assert.match(prerenderSource, /name: "archiveSettings"/);
  assert.match(prerenderSource, /cacheKey: ARCHIVE_SETTINGS_CACHE_KEY/);
  assert.match(prerenderSource, /flatMap\(\(\{ navigation, archiveSettings \}\) => \[navigation, archiveSettings\]\)/);
  assert.doesNotMatch(commerceSource + postArchiveSource, /getArchivePageSize/);
});
test("multi-column community cards stretch across their grid cells", () => {
  assert.match(socialGridSource, /flex h-full w-full items-stretch justify-center/);
});
