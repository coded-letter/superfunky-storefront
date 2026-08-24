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

test("studio layout keeps product details, reviews, and connections below its primary columns", () => {
  assert.match(productPage, /data-product-page-layout="studio"/);
  assert.match(productPage, /lg:sticky lg:top-28/);
  assert.match(productPage, /aria-label="Product information"[\s\S]*?\{summary\}[\s\S]*?<\/section>[\s\S]*?\{details\}[\s\S]*?\{reviews\}[\s\S]*?\{connections\}/);
  assert.doesNotMatch(productPage, /lg:max-h-\[calc\(100dvh-8rem\)\]|lg:overflow-y-auto/);
  assert.match(productPage, /layout === "classic"/);
});

test("studio layout places only meaningful long descriptions below its actions", () => {
  assert.match(
    productPage,
    /Add to wishlist[\s\S]*?productPageLayout === "studio" && hasLongDescription[\s\S]*?Product details[\s\S]*?<dl className=/,
  );
  assert.match(productPage, /hasMeaningfulProductHtml\(product\.descriptionHtml\)/);
  assert.match(productPage, /displayAttributes = product\.attributes\.flatMap/);
  assert.match(
    productPage,
    /details=\{productPageLayout === "classic"[\s\S]*?: \([\s\S]*?displayAttributes\.length \? \([\s\S]*?Product attributes/,
  );
});

test("backend layout hydration applies the product template from the storefront config", () => {
  assert.match(preferenceSync, /setProductPageLayout\(layout\.productPageLayout\)/);
});

test("related product columns are configurable across all product recommendation grids", () => {
  assert.match(productPage, /ProductConnections title="Related products"[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /ProductConnections title="You may also like"[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /ProductConnections title="Frequently bought together"[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /"2": "lg:grid-cols-2"[\s\S]*"3": "lg:grid-cols-3"[\s\S]*"4": "lg:grid-cols-4"/);
  assert.match(productPage, /data-related-products-columns=\{columns\}/);
  assert.match(preferenceSync, /setRelatedProductsColumns\(layout\.relatedProductsColumns\)/);
});

test("studio layout can place all recommendation groups below product metadata", () => {
  assert.match(
    productPage,
    /<dl className=[\s\S]*?Categories[\s\S]*?Brands[\s\S]*?showStudioRelatedProductsUnderMeta[\s\S]*?<ProductConnectionsList/,
  );
  assert.match(
    productPage,
    /productPageLayout === "studio" && showStudioRelatedProductsUnderMeta[\s\S]*?\? null[\s\S]*?: <ProductConnectionsList/,
  );
  assert.match(
    preferenceSync,
    /setShowStudioRelatedProductsUnderMeta\(layout\.showStudioRelatedProductsUnderMeta\)/,
  );
});
