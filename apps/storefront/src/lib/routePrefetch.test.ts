import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./routePrefetch.ts", import.meta.url), "utf8");
const documentWarmupSource = readFileSync(new URL("./storefrontDocumentWarmup.ts", import.meta.url), "utf8");
const contentNodeRouteSource = readFileSync(new URL("../pages/ContentNodeRoute.tsx", import.meta.url), "utf8");

test("commerce taxonomy prefetch bypasses generic and protected page lookup", () => {
  assert.match(source, /const documentWarmup = warmStorefrontDocument[\s\S]*await documentWarmup;/);
  assert.match(documentWarmupSource, /#storefront-route-payload/);
  assert.match(documentWarmupSource, /seedStorefrontHydration\(JSON\.parse\(routePayload\)\)/);
  assert.match(documentWarmupSource, /seedStorefrontHydration\(await hydrationResponse\.json\(\)\)/);
  assert.match(documentWarmupSource, /signal: AbortSignal\.timeout\(2_000\)/);
  assert.match(source, /content-node:v3:/);
  assert.match(source, /\["product-category", "pro-cat"\]/);
  assert.match(source, /\["product-tag", "pro-tag"\]/);
  assert.match(source, /const taxonomy = commerceTaxonomyForPath\(pathname, languageCodes\)/);
  assert.match(source, /if \(taxonomy\) \{[\s\S]*getProductArchive\([\s\S]*return;/);
  assert.ok(
    source.indexOf("if (taxonomy)") < source.indexOf("getPageByUri(uri)"),
    "taxonomy routing must return before generic page prefetch",
  );
});

test("public author and post taxonomy archives bypass protected page lookup", () => {
  assert.match(source, /if \(prefix === "author" && slug\)/);
  assert.match(source, /prefix === "blog" && \["category", "tag"\]\.includes\(routeSegments\[1\]\)/);
  assert.match(source, /\["c", "t"\]\.includes\(prefix\)/);
  assert.match(source, /getAuthorArchive\(/);
  assert.match(source, /getPostTaxonomyArchive\(/);
  assert.ok(
    source.indexOf("if (publicArchive?.type") < source.indexOf("getPageByUri(uri)"),
    "public archive routing must return before generic page prefetch",
  );
});

test("flagship artifact pages reuse the seeded page lookup through the final renderer", () => {
  assert.match(contentNodeRouteSource, /const pageLookupCacheKey = `content-page-by-uri:v1:\$\{uri\}`/);
  assert.match(
    contentNodeRouteSource,
    /artifactRouteHydrationEnabled && page[\s\S]*pageCacheKey=\{pageLookupCacheKey\}/,
  );
});
