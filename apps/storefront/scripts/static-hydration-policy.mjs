import {
  canUseHomepageBlogSummary,
  canUseHomepageCommunityFeed,
  resolveBackendDataRequirements,
} from "../src/lib/backendDataRequirements.ts";

export function requiredStaticHydrationNames(profile, pathname, markup = "") {
  const requirements = resolveBackendDataRequirements(profile, pathname, markup);
  const names = ["navigation", "archiveSettings"];
  if (requirements.commerce) names.push("commerce");
  if (requirements.blog && ["blog", "full"].includes(profile)) {
    names.push(canUseHomepageBlogSummary(pathname, markup) ? "blogSummary" : "blog");
  }
  if (requirements.community) {
    if (canUseHomepageCommunityFeed(pathname, markup) && profile !== "shell") names.push("communityFeed");
    else if (profile === "full") names.push("community");
  }
  return names;
}

export function assertStaticHydrationAssets(profile, routes, assetsByLanguage) {
  for (const route of routes) {
    const assets = assetsByLanguage.get(route.lang.toLowerCase());
    const missing = requiredStaticHydrationNames(profile, route.path, route.cmsContent)
      .filter((name) => !assets?.[name]);
    if (missing.length) {
      throw new Error(`[hydration] ${route.path} is missing required seeds: ${missing.join(", ")}. Refusing to publish a loading-only storefront.`);
    }
  }
}
