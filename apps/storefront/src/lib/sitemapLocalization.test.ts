import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const sitemapSource = readFileSync(new URL("../pages/SitemapPage.tsx", import.meta.url), "utf8");

test("sitemap is routable for default and prefixed storefront languages", () => {
  assert.match(appSource, /<Route path="\/sitemap" element=\{<SitemapPage \/>\} \/>/);
  assert.match(appSource, /<Route path="\/:language\/sitemap" element=\{<SitemapPage \/>\} \/>/);
});

test("sitemap lists only active-language routes with canonical prefixes", () => {
  assert.match(sitemapSource, /route\.listed && route\.lang\.toLowerCase\(\) === languageCode/);
  assert.match(
    sitemapSource,
    /to=\{normalizeLanguagePath\(route\.path, languageCode, configuredLanguageCodes\)\}/,
  );
  assert.match(sitemapSource, /canonical=\{sitemapPath\}/);
  assert.match(sitemapSource, /href: homePath/);
});
