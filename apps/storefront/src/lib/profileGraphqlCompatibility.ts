import type { StorefrontBackendProfile } from "@funky/sdk";
import { createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import {
  removeGraphqlFieldSelections,
  removeNestedGraphqlFieldSelections,
} from "./graphqlFieldFallback.ts";
import { createCompatiblePostArchiveQuery } from "./postArchiveGraphqlCompatibility.ts";

export function shouldPreferCoreGraphqlQueries(profile: StorefrontBackendProfile): boolean {
  return profile !== "full";
}

export function shouldPreferCoreContentQueries(profile: StorefrontBackendProfile): boolean {
  return profile === "shell" || profile === "shop";
}

export function createProfilePageQuery(
  query: string,
  profile: StorefrontBackendProfile,
): string {
  if (shouldPreferCoreContentQueries(profile)) return createCorePageQuery(query);
  return profile === "blog" ? createBlogContentQuery(query) : query;
}

export function createProfilePostQuery(
  query: string,
  profile: StorefrontBackendProfile,
): string {
  if (shouldPreferCoreContentQueries(profile)) return createCorePostQuery(query);
  return profile === "blog"
    ? removeNestedGraphqlFieldSelections(createBlogContentQuery(query), "comments", "author")
    : query;
}

function createBlogContentQuery(query: string): string {
  return ["themeStyles", "language"].reduce(removeGraphqlFieldSelections, query);
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

export function createLanguageCompatiblePageQuery(query: string): string {
  return [
    "template",
    "language",
    "enqueuedScripts",
    "seo",
    "themeStyles",
  ].reduce(removeGraphqlFieldSelections, query);
}

export function createCoreRouteRegistryQuery(query: string): string {
  return removeGraphqlFieldSelections(query, "language")
    .replace(/where:\s*\{\s*status:\s*PUBLISH\s*\}\s*,\s*/g, "");
}

export function createCorePostQuery(query: string): string {
  return createCompatibleBlogDataQuery(
    ["enqueuedScripts", "seo", "themeStyles"].reduce(removeGraphqlFieldSelections, query),
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
  return createCompatiblePostArchiveQuery(query);
}
