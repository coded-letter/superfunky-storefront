export const CONTENT_SHORTCODE_NAMES = Object.freeze([
  "hero",
  "categories",
  "slider",
  "carousel",
  "grid",
  "sticky-posts",
  "sticky_posts",
  "tags",
  "authors",
  "reviews",
  "comments",
  "community-feed",
  "community-hero",
  "community-marketplace",
  "community-tag-picks",
  "community-members",
  "testimonials",
  "related-sections",
  "order-success",
  "unsubscribe-form",
  "funkycommerce_map",
  "funkycommerce_locations",
  "gml_map",
  "sorted_locations",
]);

export const APPLICATION_SHORTCODE_NAMES = Object.freeze([
  "product_archive",
  "post_archive",
  "cart",
  "checkout",
  "wishlist",
  "reading_list",
  "account",
  "auth",
]);

export const SHORTCODE_ALIASES = Object.freeze({
  funkycommerce_shop: "product_archive",
  funkycommerce_blog: "post_archive",
  funkycommerce_cart: "cart",
  woocommerce_cart: "cart",
  funkycommerce_checkout: "checkout",
  woocommerce_checkout: "checkout",
  funkycommerce_wishlist: "wishlist",
  funkycommerce_reading_list: "reading_list",
  funkycommerce_account: "account",
  woocommerce_my_account: "account",
  funkycommerce_auth: "auth",
});

export const SUPPORTED_SHORTCODE_NAMES = Object.freeze([
  ...CONTENT_SHORTCODE_NAMES,
  ...APPLICATION_SHORTCODE_NAMES,
  ...Object.keys(SHORTCODE_ALIASES),
]);

export function canonicalShortcodeName(name) {
  const normalized = String(name).toLowerCase();
  return SHORTCODE_ALIASES[normalized] || normalized;
}
