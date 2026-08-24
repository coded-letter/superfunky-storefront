import type { SearchResultItem } from "@funky/ui";
import {
  BACKEND_ORIGIN,
  STOREFRONT_DEFAULT_LANGUAGE,
  STOREFRONT_EXPECTED_LOCALES,
} from "@funky/sdk";
import {
  mapStorefrontSearchResults,
  type StorefrontSearchQueryResult,
} from "./searchMapping.ts";

type RestSearchNode = {
  id?: number;
  link?: string;
  name?: string;
  slug?: string;
  title?: { rendered?: string };
};

type RestSearchOptions = {
  backendOrigin?: string;
  defaultLanguage?: string;
  expectedLocales?: readonly string[];
  fetchImpl?: typeof fetch;
  normalizeLabel?: (value: string) => string;
};

type RestSearchResource = "posts" | "pages" | "categories" | "tags";

export async function searchWordPressRest(
  query: string,
  routeLanguageCode: string,
  t: (key: string) => string = (key) => key,
  options: RestSearchOptions = {},
): Promise<SearchResultItem[]> {
  const backendOrigin = options.backendOrigin ?? BACKEND_ORIGIN;
  if (!backendOrigin) {
    throw new Error("The WordPress search endpoint is unavailable because no backend origin is configured");
  }

  const languageCode = routeLanguageCode.trim().toLowerCase();
  const defaultLanguage = (options.defaultLanguage ?? STOREFRONT_DEFAULT_LANGUAGE).trim().toLowerCase();
  const expectedLocales = normalizeLocales(options.expectedLocales ?? STOREFRONT_EXPECTED_LOCALES, defaultLanguage);
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalizeLabel = options.normalizeLabel ?? ((value: string) => value);
  const [posts, pages, categories, tags] = await Promise.all([
    searchRestResource("posts", query, languageCode, backendOrigin, fetchImpl),
    searchRestResource("pages", query, languageCode, backendOrigin, fetchImpl),
    searchRestResource("categories", query, languageCode, backendOrigin, fetchImpl),
    searchRestResource("tags", query, languageCode, backendOrigin, fetchImpl),
  ]);

  const localized = (nodes: RestSearchNode[]) =>
    nodes.filter((node) =>
      matchesRouteLanguage(node.link, languageCode, defaultLanguage, expectedLocales, backendOrigin));
  const data: StorefrontSearchQueryResult = {
    products: null,
    posts: { nodes: localized(posts).flatMap((node) => mapRestContentNode(node, "post", backendOrigin)) },
    pages: { nodes: localized(pages).flatMap((node) => mapRestContentNode(node, "page", backendOrigin)) },
    postCategories: { nodes: localized(categories).flatMap((node) => mapRestTermNode(node, "category", backendOrigin)) },
    postTags: { nodes: localized(tags).flatMap((node) => mapRestTermNode(node, "tag", backendOrigin)) },
    productCategories: null,
    productTags: null,
    productBrands: null,
    authors: null,
    communityPosts: null,
    communityTags: null,
    communityMembers: null,
  };

  return mapStorefrontSearchResults(data, query, languageCode, t, normalizeLabel);
}

async function searchRestResource(
  resource: RestSearchResource,
  query: string,
  languageCode: string,
  backendOrigin: string,
  fetchImpl: typeof fetch,
): Promise<RestSearchNode[]> {
  const url = new URL(`/wp-json/wp/v2/${resource}`, backendOrigin);
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", resource === "posts" ? "6" : "4");
  if (languageCode) url.searchParams.set("lang", languageCode);
  url.searchParams.set("_fields", resource === "posts" || resource === "pages"
    ? "id,title,slug,link"
    : "id,name,slug,link");

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`The WordPress ${resource} search failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`The WordPress ${resource} search returned an invalid payload`);
  }
  return payload;
}

function mapRestContentNode(
  node: RestSearchNode,
  type: "post" | "page",
  backendOrigin: string,
) {
  const id = validRestId(node.id);
  const title = node.title?.rendered?.trim();
  const slug = node.slug?.trim();
  const uri = restPathname(node.link, backendOrigin);
  return id && title && slug && uri ? [{ id: `${type}:${id}`, title, slug, uri }] : [];
}

function mapRestTermNode(
  node: RestSearchNode,
  type: "category" | "tag",
  backendOrigin: string,
) {
  const id = validRestId(node.id);
  const name = node.name?.trim();
  const slug = node.slug?.trim();
  const uri = restPathname(node.link, backendOrigin);
  return id && name && slug && uri ? [{ id: `${type}:${id}`, name, slug, uri }] : [];
}

function restPathname(link: string | undefined, backendOrigin: string): string | null {
  if (!link) return null;
  try {
    const url = new URL(link, backendOrigin);
    return url.origin === new URL(backendOrigin).origin ? url.pathname : null;
  } catch {
    return null;
  }
}

function validRestId(value: number | undefined): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function normalizeLocales(locales: readonly string[], defaultLanguage: string): string[] {
  return [...new Set([defaultLanguage, ...locales].map((locale) => locale.trim().toLowerCase()).filter(Boolean))];
}

function matchesRouteLanguage(
  link: string | undefined,
  languageCode: string,
  defaultLanguage: string,
  expectedLocales: readonly string[],
  backendOrigin: string,
): boolean {
  if (!link || expectedLocales.length < 2) return true;
  const pathname = restPathname(link, backendOrigin);
  if (!pathname) return false;
  const prefix = pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  return languageCode === defaultLanguage
    ? !expectedLocales.includes(prefix)
    : prefix === languageCode;
}
