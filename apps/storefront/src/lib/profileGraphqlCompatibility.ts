import type { StorefrontBackendProfile } from "@funky/sdk";
import { createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { removeGraphqlFieldSelections } from "./graphqlFieldFallback.ts";
import { createCompatiblePostArchiveQuery } from "./postArchiveGraphqlCompatibility.ts";

export function shouldPreferCoreGraphqlQueries(profile: StorefrontBackendProfile): boolean {
  return profile !== "full";
}

export function createCorePageQuery(query: string): string {
  return [
    "template",
    "language",
    "translations",
    "enqueuedScripts",
    "seo",
    // themeStyles resolves the exact same global block-theme data on every single
    // request (an expensive, uncached WordPress core computation) that the app
    // already fetches once via WordPressThemeStylesProvider — requesting it again
    // per page turns every page/post/product load into a duplicate slow query.
    "themeStyles",
  ].reduce(removeGraphqlFieldSelections, query);
}

export function createCorePostQuery(query: string): string {
  return createCompatibleBlogDataQuery(
    ["comments", "enqueuedScripts", "seo", "themeStyles"].reduce(removeGraphqlFieldSelections, query),
  );
}

export function createCoreBlogQuery(query: string): string {
  return createCompatibleBlogDataQuery(
    ["content", "comments", "seo", "enqueuedScripts"].reduce(removeGraphqlFieldSelections, query),
  )
    .replace(/status:\s*PUBLISH\s*,\s*/g, "")
    .replace(/,\s*status:\s*PUBLISH/g, "")
    .replace(/status:\s*PUBLISH/g, "")
    .replace(/(categories|tags)\(first:\s*100,\s*where:\s*\{[^{}]*\}\)/g, "$1(first: 100)");
}

export function createCorePostArchiveQuery(query: string): string {
  return createCoreBlogQuery(createCompatiblePostArchiveQuery(query));
}
