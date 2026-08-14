import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sources = {
  cms: read("../src/components/CmsPageContent.tsx"),
  hero: read("../src/components/HeroMock.tsx"),
  chrome: read("../../../packages/ui/src/layout/StorefrontChromeMockup.tsx"),
  footer: read("../../../packages/ui/src/layout/FooterMockup.tsx"),
  header: read("../../../packages/ui/src/layout/HeaderMockup.tsx"),
  productCard: read("../../../packages/ui/src/catalog/ProductCard.tsx"),
};

test("public component hooks use the reserved semantic namespace", () => {
  assert.match(sources.header, /id="sf-header"/);
  assert.match(sources.header, /\bsf-header\b/);
  assert.match(sources.chrome, /id="sf-main"/);
  assert.match(sources.footer, /id="sf-footer"/);
  assert.match(sources.productCard, /\bsf-product-card\b/);
  assert.match(sources.hero, /\bsf-hero\b/);
});

test("every CMS shortcode receives stable generic and name-specific hooks", () => {
  assert.match(sources.cms, /sf-shortcode sf-shortcode-/);
  assert.match(sources.cms, /normalizeShortcodeName\(name\)/);
});

test("static public IDs are unique", () => {
  const allSources = Object.values(sources).join("\n");
  const ids = [...allSources.matchAll(/\bid="(sf-[a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}
