const COMMERCE_ROUTE_TYPES = new Set([
  "ExternalProduct",
  "GroupProduct",
  "Product",
  "SimpleProduct",
  "VariableProduct",
]);

export function stableRouteIsAvailable(stableRoute, discoveredRoutes, languageCode) {
  if (!stableRoute.indexable) return true;

  const normalizedLanguage = languageCode.trim().toLowerCase();
  const discoveredTypes = new Set(
    discoveredRoutes
      .filter(({ lang }) => lang?.trim().toLowerCase() === normalizedLanguage)
      .map(({ type }) => type)
      .filter(Boolean),
  );
  const hasBlog = discoveredTypes.has("Post");
  const hasCommerce = [...discoveredTypes].some((type) => COMMERCE_ROUTE_TYPES.has(type));

  if (stableRoute.path === "/blog" || stableRoute.path === "/author") return hasBlog;
  if (stableRoute.path === "/shop") return hasCommerce;
  if (stableRoute.path === "/product-brand") return discoveredTypes.has("ProductBrand");
  if (stableRoute.path === "/community") return discoveredTypes.has("CommunityPost");
  if (stableRoute.path === "/community-author") return discoveredTypes.has("CommunityAuthor");
  if (stableRoute.path === "/community-tag") return discoveredTypes.has("CommunityTag");
  return true;
}
