import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeProductPageLayout } from "../../../../packages/ui/src/state/productPageLayout.ts";

const productPage = readFileSync(new URL("../pages/ProductMockupPage.tsx", import.meta.url), "utf8");
const preferenceSync = readFileSync(new URL("layoutPreferencesSync.ts", import.meta.url), "utf8");

test("normalizes the persisted product template preference safely", () => {
  assert.equal(normalizeProductPageLayout("studio"), "studio");
  assert.equal(normalizeProductPageLayout("classic"), "classic");
  assert.equal(normalizeProductPageLayout("unexpected"), "classic");
  assert.equal(normalizeProductPageLayout(null), "classic");
});

test("studio layout keeps one mobile flow and bounded keyboard-scrollable desktop rail", () => {
  assert.match(productPage, /data-product-page-layout="studio"/);
  assert.match(productPage, /lg:sticky lg:top-28/);
  assert.match(productPage, /aria-label="Product information"[\s\S]*?tabIndex=\{0\}/);
  assert.match(productPage, /lg:max-h-\[calc\(100dvh-8rem\)\] lg:overflow-y-auto/);
  assert.doesNotMatch(productPage, /overscroll-contain/);
  assert.match(productPage, /layout === "classic"/);
  assert.match(productPage, /ProductConnections[\s\S]*?compact=\{productPageLayout === "studio"\}/);
});

test("backend layout hydration applies the product template from the storefront config", () => {
  assert.match(preferenceSync, /setProductPageLayout\(layout\.productPageLayout\)/);
});
