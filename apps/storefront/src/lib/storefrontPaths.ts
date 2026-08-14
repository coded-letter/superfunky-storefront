import {
  normalizeLanguagePath,
  resolveCanonicalLanguagePath,
  resolveCanonicalLanguageRoute,
  useLanguage,
  type CanonicalLanguageRouteResolution,
} from "@funky/ui";
import { useIncrementalData } from "@funky/sdk/react";
import { graphqlRequest } from "@funky/sdk";
import {
  missingGraphqlFieldRule,
  requestGraphqlWithCompatibility,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback";
import {
  classifyPageRouteKeys,
  type RoutePageNode,
  type StorefrontRouteKey,
} from "./storefrontRouteClassification";
import { STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { shouldPreferCoreGraphqlQueries } from "./profileGraphqlCompatibility";

export type { StorefrontRouteKey } from "./storefrontRouteClassification";

export type RouteRegistryEntry = {
  key: StorefrontRouteKey;
  uri: string;
  languageCode: string;
};

type RouteRegistryResult = {
  pages: {
    nodes: RoutePageNode[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  } | null;
};

const ROUTE_REGISTRY_CACHE_KEY = "storefront-route-registry:v4";

const ROUTE_REGISTRY_QUERY = /* GraphQL */ `
  query StorefrontRouteRegistry($after: String) {
    pages(where: { status: PUBLISH }, first: 100, after: $after) {
      nodes {
        uri
        slug
        isFrontPage
        language {
          code
        }
        headlessShortcodes
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PAGE_STATUS_COMPATIBILITY_RULE: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: (query) => query.replace(/where:\s*\{\s*status:\s*PUBLISH\s*\}\s*,\s*/g, ""),
};

const ROUTE_REGISTRY_COMPATIBILITY_RULES = [
  PAGE_STATUS_COMPATIBILITY_RULE,
  missingGraphqlFieldRule("language"),
] as const;

function normalizeUri(uri: string): string {
  const pathname = uri.startsWith("/") ? uri : `/${uri}`;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function normalizePathname(pathname: string): string {
  return normalizeUri(pathname === "/" ? "/" : pathname);
}

function normalizeLanguageCode(languageCode: string | null | undefined): string {
  return languageCode?.toLowerCase() || "en";
}

export async function getStorefrontRouteRegistry(): Promise<RouteRegistryEntry[]> {
  const entries: RouteRegistryEntry[] = [];
  let after: string | null = null;
  do {
    const result = await requestGraphqlWithCompatibility<RouteRegistryResult>(
      graphqlRequest,
      ROUTE_REGISTRY_QUERY,
      { after },
      ROUTE_REGISTRY_COMPATIBILITY_RULES,
    );
    const { data, errors } = result;
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    const pages: RouteRegistryResult["pages"] = data?.pages ?? null;
    if (!pages) throw new Error("The storefront route registry query returned no pages");

    for (const page of pages.nodes) {
      if (!page.uri) continue;
      for (const key of classifyPageRouteKeys(page)) {
        entries.push({
          key,
          uri: normalizeUri(page.uri),
          languageCode: normalizeLanguageCode(page.language?.code),
        });
      }
    }

    if (!pages.pageInfo.hasNextPage) break;
    if (!pages.pageInfo.endCursor) {
      throw new Error("The storefront route registry returned an incomplete pagination cursor");
    }
    after = pages.pageInfo.endCursor;
  } while (after);
  return entries;
}

export function resolveStorefrontPath(
  registry: RouteRegistryEntry[],
  key: StorefrontRouteKey,
  languageCode: string,
  fallback: string,
): string {
  const normalizedLanguageCode = normalizeLanguageCode(languageCode);
  const localized = registry.find((entry) => entry.key === key && entry.languageCode === normalizedLanguageCode);
  if (localized) return localized.uri;

  const englishFallback = registry.find((entry) => entry.key === key && entry.languageCode === "en");
  if (englishFallback) return englishFallback.uri;

  const firstMatch = registry.find((entry) => entry.key === key);
  return firstMatch?.uri || fallback;
}

export function matchStorefrontRouteKey(
  registry: RouteRegistryEntry[],
  pathname: string,
): StorefrontRouteKey | null {
  return matchStorefrontRoute(registry, pathname)?.key || null;
}

export function matchStorefrontRoute(
  registry: RouteRegistryEntry[],
  pathname: string,
): RouteRegistryEntry | null {
  const normalizedPathname = normalizePathname(pathname);
  return registry.find((entry) => entry.uri === normalizedPathname) || null;
}

export function useStorefrontPath(key: StorefrontRouteKey, fallback: string): string {
  return useResolvedStorefrontPath(key, fallback).path;
}

export function orderDetailsPath(
  orderId: number,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): string {
  return normalizeLanguagePath(`/order/${orderId}`, languageCode, configuredLanguageCodes);
}

export function useResolvedStorefrontPath(
  key: StorefrontRouteKey,
  fallback: string,
  targetLanguageCode?: string,
): { path: string; isLoading: boolean } {
  const { configuredLanguageCodes, languageCode: selectedLanguageCode } = useLanguage();
  const languageCode = targetLanguageCode?.toLowerCase() || selectedLanguageCode;
  const { data: registry, isLoading } = useIncrementalData(
    ROUTE_REGISTRY_CACHE_KEY,
    getStorefrontRouteRegistry,
    !shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE),
  );

  return {
    path: resolveCanonicalLanguagePath(
      registry || [],
      key,
      languageCode,
      configuredLanguageCodes,
      fallback,
    ),
    isLoading,
  };
}

export function useResolvedStorefrontLanguageRoute(
  pathname: string,
): { resolution: CanonicalLanguageRouteResolution<StorefrontRouteKey> | null; isLoading: boolean } {
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const { data: registry, isLoading } = useIncrementalData(
    ROUTE_REGISTRY_CACHE_KEY,
    getStorefrontRouteRegistry,
    !shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE),
  );
  return {
    resolution: resolveCanonicalLanguageRoute(
      registry || [],
      pathname,
      languageCode,
      configuredLanguageCodes,
    ),
    isLoading,
  };
}

export function useMatchedStorefrontRouteKey(pathname: string): StorefrontRouteKey | null {
  const { data: registry } = useIncrementalData(
    ROUTE_REGISTRY_CACHE_KEY,
    getStorefrontRouteRegistry,
    !shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE),
  );
  return matchStorefrontRouteKey(registry || [], pathname);
}
