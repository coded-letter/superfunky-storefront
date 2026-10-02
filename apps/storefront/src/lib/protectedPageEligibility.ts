const NON_PAGE_ROUTE_ROOTS = new Set([
  "product",
  "product-category",
  "kategoria-produktu",
  "pro-cat",
  "pro-category",
  "product-tag",
  "pro-tag",
  "brand",
  "product-brand",
  "category",
  "tag",
  "author",
  "cart",
  "checkout",
  "wishlist",
  "reading-list",
  "account",
  "auth",
  "login",
  "register",
  "forgot-password",
  "order-success",
  "unsubscribe",
  "community",
]);

export function shouldProbeProtectedPage(uri: string): boolean {
  let segments: string[];
  try {
    segments = new URL(uri, "https://storefront.invalid").pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment).toLowerCase());
  } catch {
    return false;
  }

  if (/^[a-z]{2}(?:-[a-z0-9]+)?$/.test(segments[0] || "")) {
    segments = segments.slice(1);
  }

  const [root, child] = segments;
  if (!root || NON_PAGE_ROUTE_ROOTS.has(root)) return false;
  if (root === "shop") return segments.length === 1;
  if (root === "sklep") return segments.length === 1;
  if (root === "blog") {
    return segments.length === 1 && !["category", "tag", "author"].includes(child);
  }

  return true;
}
