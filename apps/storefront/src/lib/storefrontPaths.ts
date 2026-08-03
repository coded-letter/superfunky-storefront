import { useLanguage } from "@funky/ui";
import { useIncrementalData } from "./incrementalData";
import { graphqlRequest } from "./graphqlClient";

export type StorefrontRouteKey =
  | "home"
  | "shop"
  | "blog"
  | "cart"
  | "checkout"
  | "account"
  | "wishlist"
  | "reading-list"
  | "community"
  | "auth-login"
  | "auth-register"
  | "auth-forgot-password"
  | "order-success"
  | "order-success-digital"
  | "unsubscribe";

type RoutePageNode = {
  uri: string | null;
  slug: string | null;
  language: { code: string | null } | null;
  funkycommerceSpecialPageKey?: string | null;
  headlessShortcodes?: (string | null)[] | null;
};

type RouteRegistryEntry = {
  key: StorefrontRouteKey;
  uri: string;
  languageCode: string;
};

type RouteRegistryResult = {
  pages: {
    nodes: RoutePageNode[];
  } | null;
};

const ROUTE_REGISTRY_QUERY = /* GraphQL */ `
  query StorefrontRouteRegistry {
    pages(where: { status: PUBLISH }, first: 150) {
      nodes {
        uri
        slug
        language {
          code
        }
        funkycommerceSpecialPageKey
        headlessShortcodes
      }
    }
  }
`;

const SPECIAL_ROUTE_REGISTRY_QUERY = /* GraphQL */ `
  query StorefrontSpecialRouteRegistry {
    home: funkycommerceSpecialPage(key: "home") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
    shop: funkycommerceSpecialPage(key: "shop") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
    blog: funkycommerceSpecialPage(key: "blog") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
    cart: funkycommerceSpecialPage(key: "cart") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
    checkout: funkycommerceSpecialPage(key: "checkout") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
    account: funkycommerceSpecialPage(key: "account") {
      uri
      language {
        code
      }
      translations {
        uri
        language {
          code
        }
      }
    }
  }
`;

const SPECIAL_PAGE_ROUTE_KEYS: Record<string, StorefrontRouteKey> = {
  home: "home",
  shop: "shop",
  blog: "blog",
  cart: "cart",
  checkout: "checkout",
  account: "account",
};
type SpecialRegistryPage = {
  uri: string | null;
  language?: { code: string | null } | null;
  translations?: ({ uri: string | null; language?: { code: string | null } | null } | null)[] | null;
};

type SpecialRouteRegistryResult = {
  home: SpecialRegistryPage | null;
  shop: SpecialRegistryPage | null;
  blog: SpecialRegistryPage | null;
  cart: SpecialRegistryPage | null;
  checkout: SpecialRegistryPage | null;
  account: SpecialRegistryPage | null;
};

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

function parseShortcodeAttributes(shortcode: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of shortcode.matchAll(/([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g)) {
    attributes[match[1].replaceAll("_", "-")] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function classifyPageRouteKeys(page: RoutePageNode): StorefrontRouteKey[] {
  const keys = new Set<StorefrontRouteKey>();
  const specialPageKey = page.funkycommerceSpecialPageKey || "";
  const specialRouteKey = SPECIAL_PAGE_ROUTE_KEYS[specialPageKey];
  if (specialRouteKey) {
    keys.add(specialRouteKey);
  }

  const normalizedSlug = (page.slug || "").toLowerCase();
  const shortcodes = page.headlessShortcodes?.filter((shortcode): shortcode is string => Boolean(shortcode)) || [];

  for (const shortcode of shortcodes) {
    if (shortcode.startsWith("[funkycommerce_wishlist")) {
      keys.add("wishlist");
      continue;
    }
    if (shortcode.startsWith("[funkycommerce_reading_list")) {
      keys.add("reading-list");
      continue;
    }
    if (shortcode.startsWith("[community-feed") || shortcode.startsWith("[community-hero")) {
      keys.add("community");
      continue;
    }
    if (shortcode.startsWith("[unsubscribe-form")) {
      keys.add("unsubscribe");
      continue;
    }
    if (shortcode.startsWith("[order-success")) {
      const attributes = parseShortcodeAttributes(shortcode);
      keys.add(attributes.mode === "digital" ? "order-success-digital" : "order-success");
      continue;
    }
    if (shortcode.startsWith("[funkycommerce_auth")) {
      const attributes = parseShortcodeAttributes(shortcode);
      if (attributes.mode === "register") {
        keys.add("auth-register");
      } else if (attributes.mode === "forgot-password") {
        keys.add("auth-forgot-password");
      } else {
        keys.add("auth-login");
      }
    }
  }

  if (normalizedSlug === "community") keys.add("community");
  if (normalizedSlug === "unsubscribe") keys.add("unsubscribe");

  return [...keys];
}

export async function getStorefrontRouteRegistry(): Promise<RouteRegistryEntry[]> {
  const { data, errors } = await graphqlRequest<RouteRegistryResult>(ROUTE_REGISTRY_QUERY);
  if (errors?.length) {
    const fatalErrors = errors.filter(
      (error) => !error.message.includes("funkycommerceSpecialPageKey") && !error.message.includes("headlessShortcodes"),
    );
    if (fatalErrors.length) {
      throw new Error(fatalErrors.map(({ message }) => message).join("; "));
    }
  }
  if (!data?.pages?.nodes) {
    return [];
  }

  const entries = data.pages.nodes.flatMap((page) => {
    const uri = page.uri ? normalizeUri(page.uri) : "";
    if (!uri) return [];

    return classifyPageRouteKeys(page).map((key) => ({
      key,
      uri,
      languageCode: normalizeLanguageCode(page.language?.code),
    }));
  });

  for (const entry of await getSpecialStorefrontRouteRegistry()) {
    if (!entries.some((existing) => existing.key === entry.key && existing.uri === entry.uri && existing.languageCode === entry.languageCode)) {
      entries.push(entry);
    }
  }

  return entries;
}

export async function getSpecialStorefrontRouteRegistry(): Promise<RouteRegistryEntry[]> {
  const { data: specialData, errors: specialErrors } = await graphqlRequest<SpecialRouteRegistryResult>(SPECIAL_ROUTE_REGISTRY_QUERY);
  if (specialErrors?.length) {
    throw new Error(specialErrors.map(({ message }) => message).join("; "));
  }

  const entries: RouteRegistryEntry[] = [];
  for (const [specialKey, routeKey] of Object.entries(SPECIAL_PAGE_ROUTE_KEYS) as [keyof SpecialRouteRegistryResult, StorefrontRouteKey][]) {
    const page = specialData?.[specialKey];
    const candidates = [
      page?.uri && page?.language?.code
        ? { uri: page.uri, languageCode: page.language.code }
        : null,
      ...(page?.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{ uri: translation.uri, languageCode: translation.language.code }]
          : [],
      ) || []),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      entries.push({
        key: routeKey,
        uri: normalizeUri(candidate.uri),
        languageCode: normalizeLanguageCode(candidate.languageCode),
      });
    }
  }

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
  const normalizedPathname = normalizePathname(pathname);
  const match = registry.find((entry) => entry.uri === normalizedPathname);
  return match?.key || null;
}

export function useStorefrontPath(key: StorefrontRouteKey, fallback: string): string {
  return useResolvedStorefrontPath(key, fallback).path;
}

export function useResolvedStorefrontPath(
  key: StorefrontRouteKey,
  fallback: string,
): { path: string; isLoading: boolean } {
  const { languageCode } = useLanguage();
  const { data: registry, isLoading } = useIncrementalData(
    "storefront-route-registry:v2",
    getStorefrontRouteRegistry,
  );

  return {
    path: resolveStorefrontPath(registry || [], key, languageCode, fallback),
    isLoading,
  };
}

export function useMatchedStorefrontRouteKey(pathname: string): StorefrontRouteKey | null {
  const { data: registry } = useIncrementalData(
    "storefront-route-registry:v2",
    getStorefrontRouteRegistry,
  );
  return matchStorefrontRouteKey(registry || [], pathname);
}
