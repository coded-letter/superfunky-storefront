import { classifyPageRouteKeys } from "../src/lib/storefrontRouteClassification.ts";

/**
 * Builds the same `{ key, uri, languageCode }` route-registry entries that the
 * client resolves at runtime via `getStorefrontRouteRegistry`, but from the
 * already-discovered build-time `routes` array — no extra GraphQL round trip.
 * Shared by the hydration seed asset (`writeStaticRouteRegistryAsset`) and the
 * pre-React static header/mobile navigation so both agree on the exact same
 * authoritative special-page paths (account, wishlist, reading list, ...).
 */
export function buildStaticRouteRegistryEntries(routes) {
  return routes.flatMap((route) => {
    if (!route.cmsPage) return [];
    return classifyPageRouteKeys({
      uri: route.cmsPage.uri,
      slug: route.cmsPage.slug,
      language: { code: route.cmsPage.languageCode },
      isFrontPage: route.path === "/" || route.path === `/${route.lang}`,
      headlessShortcodes: route.cmsPage.headlessShortcodes,
    }).map((key) => ({
      key,
      uri: route.cmsPage.uri,
      languageCode: route.cmsPage.languageCode,
    }));
  });
}

/**
 * Mirrors `resolveStorefrontPath` from `src/lib/storefrontPaths.ts` exactly
 * (same language match, then English, then first match, then fallback order)
 * so the static markup never disagrees with the React header once it takes
 * over the page — keeping paths aligned across the static/React swap.
 */
export function resolveStaticRouteRegistryPath(entries, key, languageCode, fallback) {
  const normalizedLanguageCode = languageCode.toLowerCase();
  const localized = entries.find((entry) => entry.key === key && entry.languageCode === normalizedLanguageCode);
  if (localized) return localized.uri;

  const englishFallback = entries.find((entry) => entry.key === key && entry.languageCode === "en");
  if (englishFallback) return englishFallback.uri;

  const firstMatch = entries.find((entry) => entry.key === key);
  return firstMatch?.uri || fallback;
}
