import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const appRoot = new URL("../", import.meta.url);

test("storefront source contains no mockup metadata fallback", async () => {
  const template = await readFile(new URL("index.html", appRoot), "utf8");

  assert.match(template, /<title>FunkyCommerce<\/title>/);
  assert.doesNotMatch(template, /Storefront Mockups/i);
});

test("prerender emits complete CMS metadata in the first document response", async () => {
  const prerender = await readFile(new URL("scripts/prerender.mjs", appRoot), "utf8");
  const routeQuery = await readFile(new URL("scripts/route-query.mjs", appRoot), "utf8");
  const generatedMetadataSource = `${prerender}\n${routeQuery}`;

  for (const field of [
    "featuredImage",
    "metaRobotsNoindex",
    "opengraphPublishedTime",
    "opengraphModifiedTime",
    "opengraphPublisher",
    "twitterImage",
  ]) {
    assert.match(generatedMetadataSource, new RegExp(field));
  }
  for (const metadata of [
    'property="og:image:width"',
    'property="og:image:height"',
    'property="article:published_time"',
    'name="twitter:image:alt"',
    'type="application/ld+json"',
    "data-storefront-seo",
  ]) {
    assert.ok(prerender.includes(metadata), `Expected prerender metadata: ${metadata}`);
  }
  assert.match(prerender, /Cache-Control", "public, max-age=0, must-revalidate"/);
});

test("client SEO removes generated metadata without restoring stale tags", async () => {
  const seo = await readFile(new URL("../../packages/ui/src/seo/Seo.tsx", appRoot), "utf8");

  assert.match(seo, /querySelectorAll\([\s\S]*data-storefront-seo\]:not\(\[data-rh\]\)/);
  assert.doesNotMatch(seo, /insertBefore\(element/);
  assert.match(seo, /image\?\.url \|\| opengraphImage/);
  assert.match(seo, /property="og:image:alt"/);
  assert.match(seo, /property="article:modified_time"/);
  assert.match(seo, /name="twitter:image:alt"/);
});

test("client SEO cleanup preserves prerendered titles adopted by Helmet", () => {
  const dom = new JSDOM(`<!doctype html><head>
    <title data-storefront-seo data-rh="true">Adopted title</title>
    <meta data-storefront-seo name="description" content="Stale description">
  </head>`);

  dom.window.document.head
    .querySelectorAll(
      '[data-storefront-seo]:not([data-rh]), meta[name="description"]:not([data-rh]), link[rel="canonical"]:not([data-rh])',
    )
    .forEach((element) => element.remove());

  assert.equal(dom.window.document.title, "Adopted title");
  assert.equal(dom.window.document.querySelector('meta[name="description"]'), null);
});

test("controlled crawler files remain exact and product feed uses its canonical address", async () => {
  const prerender = await readFile(new URL("scripts/prerender.mjs", appRoot), "utf8");
  const feedDiscovery = await readFile(new URL("src/components/GlobalFeedDiscovery.tsx", appRoot), "utf8");

  assert.match(
    prerender,
    /writeControlledFile\("robots\.txt", staticGenerationConfig\.robotsEnabled, staticGenerationConfig\.robotsTxt\)/,
  );
  assert.match(prerender, /\/product\.feed\.xml  \/product-feed\.xml  301/);
  assert.match(prerender, /apple-developer-merchantid-domain-association  \/index\.html  404/);
  assert.match(prerender, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(prerender, /writeAppleMerchantFile\(staticGenerationConfig\.appleMerchantFile\)/);
  assert.match(prerender, /await writeFile\(target, configuredContent\)/);
  assert.match(prerender, /if \(existingContent\.trim\(\)\) return true/);
  assert.match(prerender, /source === "cms" \|\| indexable/);
  assert.match(prerender, /listed: sitemapRoutePaths\.has\(path\)/);
  assert.match(feedDiscovery, /href="\/product-feed\.xml"/);
  assert.doesNotMatch(feedDiscovery, /href="\/product\.feed\.xml"/);
});

test("prerender authenticates route discovery and preserves stable routes during optional discovery failures", async () => {
  const prerender = await readFile(new URL("scripts/prerender.mjs", appRoot), "utf8");

  assert.match(prerender, /\{ Origin: graphqlRequestOrigin \}/);
  assert.match(prerender, /process\.env\.VITE_GRAPHQL_ENDPOINT\?\.trim\(\)\s*\|\| "https:\/\/dev\.superfunky\.pro\/graphql"/);
  assert.match(prerender, /Optional route SEO discovery unavailable/);
  assert.match(prerender, /Optional public robots discovery unavailable; using core route metadata/);
  assert.match(prerender, /\{ attempts: 5, timeoutMs: 60_000 \}/);
  assert.match(prerender, /WPGraphQL community member route discovery",\s*\{ attempts: 2, timeoutMs: 10_000 \}/);
  assert.match(prerender, /community tag route discovery`,\s*\{ attempts: 2, timeoutMs: 10_000 \}/);
  assert.match(prerender, /CMS route discovery failed; refusing to generate a partial sitemap/);
  assert.match(prerender, /Optional community detail route discovery unavailable; using stable community directory routes/);
  assert.doesNotMatch(prerender, /Community route discovery failed; refusing to generate a partial sitemap/);
  assert.match(prerender, /endCursor === cursors\[cursorName\]/);
  assert.doesNotMatch(prerender, /CMS route discovery skipped:/);
});
