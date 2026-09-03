import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeProductPageLayout } from "../../../../packages/ui/src/state/productPageLayout.ts";

const productPage = readFileSync(new URL("../pages/ProductMockupPage.tsx", import.meta.url), "utf8");
const productGallery = readFileSync(new URL("../../../../packages/ui/src/catalog/ProductGallery.tsx", import.meta.url), "utf8");
const quickView = readFileSync(new URL("../../../../packages/ui/src/catalog/ProductQuickViewModal.tsx", import.meta.url), "utf8");
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
  assert.match(productPage, /aria-label=\{t\("product\.information_aria"\)\}[\s\S]*?\{summary\}[\s\S]*?<\/section>[\s\S]*?\{details\}[\s\S]*?\{reviews\}[\s\S]*?\{connections\}/);
  assert.doesNotMatch(productPage, /lg:max-h-\[calc\(100dvh-8rem\)\]|lg:overflow-y-auto/);
  assert.match(productPage, /layout === "classic"/);
});

test("product media stays top-aligned with thumbnails immediately after the main image", () => {
  assert.match(productPage, /layout === "classic"[\s\S]*?lg:items-start/);
  assert.match(productGallery, /grid content-start gap-4 self-start/);
  assert.match(productGallery, /<\/button>[\s\S]*?images\.length > 1[\s\S]*?scrollbar-thin flex gap-3/);
});

test("studio layout places only the configured secondary description below its actions", () => {
  assert.match(
    productPage,
    /product\.add_wishlist[\s\S]*?productPageLayout === "studio" && hasSecondaryDescription[\s\S]*?product\.details_heading[\s\S]*?<dl className=/,
  );
  assert.match(productPage, /hasMeaningfulProductHtml\(secondaryDescriptionHtml\)/);
  assert.match(productPage, /displayAttributes = product\.attributes\.flatMap/);
  assert.match(
    productPage,
    /details=\{productPageLayout === "classic"[\s\S]*?hasSecondaryDescription \|\| displayAttributes\.length[\s\S]*?product\.attributes_heading/,
  );
});

test("backend layout hydration applies the product template from the storefront config", () => {
  assert.match(preferenceSync, /setProductPageLayout\(layout\.productPageLayout\)/);
  assert.match(preferenceSync, /setProductPageWishlistButtonLayout\(layout\.productPageWishlistButtonLayout\)/);
  assert.match(preferenceSync, /setProductPageWishlistIcon\(layout\.productPageWishlistIcon\)/);
  assert.match(preferenceSync, /setProductDescriptionsOrder\(layout\.productDescriptionsOrder\)/);
});

test("product wishlist supports full, icon, and disabled layouts", () => {
  assert.match(productPage, /productPageWishlistButtonLayout === "icon"[\s\S]*?<ProductWishlistIconButton/);
  assert.match(productPage, /productPageWishlistButtonLayout === "full"[\s\S]*?<ProductWishlistTextButton/);
  assert.match(productPage, /icon === "star" \? Star : icon === "bookmark" \? Bookmark : Heart/);
});

test("product descriptions swap primary and secondary positions without being dropped", () => {
  assert.match(
    productPage,
    /primaryDescriptionHtml = productDescriptionsOrder === "long-first"[\s\S]*?product\.descriptionHtml[\s\S]*?product\.shortDescriptionHtml/,
  );
  assert.match(
    productPage,
    /secondaryDescriptionHtml = productDescriptionsOrder === "long-first"[\s\S]*?product\.shortDescriptionHtml[\s\S]*?product\.descriptionHtml/,
  );
  assert.match(productPage, /renderProductContent\(primaryDescriptionHtml\)/);
  assert.match(productPage, /renderProductContent\(secondaryDescriptionHtml\)/);
  assert.match(quickView, /resolveProductQuickViewDescription\(product, productDescriptionsOrder\)/);
});

test("related product columns are configurable across all product recommendation grids", () => {
  assert.match(productPage, /ProductConnections title=\{t\("product\.related"\)\}[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /ProductConnections title=\{t\("product\.upsells"\)\}[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /ProductConnections title=\{t\("product\.cross_sells"\)\}[\s\S]*columns=\{columns\}/);
  assert.match(productPage, /"2": "lg:grid-cols-2"[\s\S]*"3": "lg:grid-cols-3"[\s\S]*"4": "lg:grid-cols-4"/);
  assert.match(productPage, /data-related-products-columns=\{columns\}/);
  assert.match(preferenceSync, /setRelatedProductsColumns\(layout\.relatedProductsColumns\)/);
});

test("studio layout can place all recommendation groups below product metadata", () => {
  assert.match(
    productPage,
    /<dl className=[\s\S]*?product\.meta\.categories[\s\S]*?product\.meta\.brands[\s\S]*?showStudioRelatedProductsUnderMeta[\s\S]*?<ProductConnectionsList/,
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
