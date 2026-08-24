import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const auth = source("../pages/AuthMockupPage.tsx");
const readingList = source("../pages/ReadingListMockupPage.tsx");
const wishlist = source("../pages/WishlistMockupPage.tsx");
const cart = source("../pages/CartMockupPage.tsx");
const checkout = source("../pages/CheckoutMockupPage.tsx");
const productArchive = source("../pages/ProductTaxonomyArchivePage.tsx");
const shortcodes = source("../components/wordpressShortcodes.tsx");

test("application pages read global backend/Studio layout preferences instead of shortcode presentation attributes", () => {
  assert.match(auth, /authLayout: layout/);
  assert.match(readingList, /readingListLayout: layout/);
  assert.match(wishlist, /wishlistCardVariant: cardStyle/);
  assert.match(cart, /cartLayout: layout, cartSummaryPosition/);
  assert.match(productArchive, /cardVariant=\{shopProductCardVariant\}/);

  assert.doesNotMatch(auth, /config\.layout/);
  assert.doesNotMatch(readingList, /config\.layout/);
  assert.doesNotMatch(wishlist, /config\["card-variant"\]/);
  assert.doesNotMatch(cart, /config\.(?:layout)|config\["summary-position"\]/);
});

test("checkout layout controls are authoritative while non-layout shortcode behavior remains supported", () => {
  for (const field of [
    "checkoutStoreMode",
    "checkoutCouponPosition",
    "checkoutPaymentPosition",
    "checkoutSummaryPosition",
    "checkoutHideOptionalBillingFields",
    "checkoutHideOptionalShippingFields",
    "checkoutShowOrderNotes",
    "checkoutShowTerms",
    "checkoutShowPrivacy",
  ]) {
    assert.match(checkout, new RegExp(`\\b${field}\\b`));
  }

  assert.match(checkout, /"allow-guest-checkout": "true"/);
  assert.doesNotMatch(checkout, /config\["(?:coupon-position|payment-position|summary-position|hide-optional|show-order-notes|show-terms|show-privacy)/);
  assert.doesNotMatch(checkout, /config\.mode/);
});

test("CMS-rendered home and community surfaces consume global layout preferences", () => {
  for (const field of [
    "homeHeroLayout",
    "communityFeedLayout",
    "communityFeedLoadMode",
    "communityFeedPageSize",
    "communityFeedFilters",
  ]) {
    assert.match(shortcodes, new RegExp(`\\b${field}\\b`));
  }

  assert.match(shortcodes, /isCurrentRoute\(pathname, homePath\)/);
  assert.doesNotMatch(shortcodes, /shopProductCardVariant/);
  assert.match(shortcodes, /oneOf<SocialFeedLayout>\(attributes\.layout.*communityFeedLayout/);
});

test("CMS product collections honor their shortcode card variant", () => {
  assert.match(
    shortcodes,
    /const variant = oneOf<ProductCardVariant>\(attributes\["card-variant"\], PRODUCT_CARD_VARIANTS, "default"\)/,
  );
  assert.match(
    shortcodes,
    /cardVariant=\{oneOf<ProductCardVariant>\(attributes\["card-variant"\], PRODUCT_CARD_VARIANTS, "default"\)\}/,
  );
});
