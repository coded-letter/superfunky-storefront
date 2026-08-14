import type { SearchResultItem, SearchResultType } from "@funky/ui";
import { normalizeCommunityHandle } from "./communityProfiles.ts";

type SearchNode = {
  id: string;
  databaseId?: number;
  title?: string | null;
  name?: string | null;
  uri: string | null;
  slug: string | null;
};

type SearchAuthorNode = {
  id: string;
  databaseId: number;
  name: string | null;
  slug: string | null;
  uri: string | null;
};

type SearchCommunityMemberNode = {
  databaseId: number;
  name: string | null;
  communityHandle: string | null;
  description: string | null;
  communityProfilePublic: boolean | null;
};

export type StorefrontSearchQueryResult = {
  products: { nodes: SearchNode[] } | null;
  posts: { nodes: SearchNode[] } | null;
  pages: { nodes: SearchNode[] } | null;
  postCategories: { nodes: SearchNode[] } | null;
  postTags: { nodes: SearchNode[] } | null;
  productCategories: { nodes: SearchNode[] } | null;
  productTags: { nodes: SearchNode[] } | null;
  productBrands: { nodes: SearchNode[] } | null;
  authors: { nodes: SearchAuthorNode[] } | null;
  communityPosts: { nodes: SearchNode[] } | null;
  communityTags: { nodes: SearchNode[] } | null;
  communityMembers: SearchCommunityMemberNode[] | null;
};

type NormalizeLabel = (value: string) => string;

export function mapStorefrontSearchResults(
  data: StorefrontSearchQueryResult,
  query: string,
  routeLanguageCode: string,
  t: (key: string) => string = (key) => key,
  normalizeLabel: NormalizeLabel = (value) => value,
): SearchResultItem[] {
  const languagePrefix = normalizeLanguagePrefix(routeLanguageCode);
  const results = [
    ...mapContentResults(data.products?.nodes, "product", t("search.type.product"), normalizeLabel, (node) =>
      resolveCanonicalPath("product", node.slug, node.uri)),
    ...mapContentResults(data.posts?.nodes, "post", t("search.type.post"), normalizeLabel, (node) =>
      resolveCanonicalPath("blog", node.slug, node.uri)),
    ...mapContentResults(data.pages?.nodes, "page", t("search.type.page"), normalizeLabel, (node) =>
      resolveInternalHref(node.uri, contentPath("", node.slug))),
    ...mapTermResults(data.postCategories?.nodes, "post_category", t("search.type.post_category"), "blog/category", normalizeLabel),
    ...mapTermResults(data.postTags?.nodes, "post_tag", t("search.type.post_tag"), "blog/tag", normalizeLabel),
    ...mapTermResults(data.productCategories?.nodes, "product_category", t("search.type.product_category"), "shop/category", normalizeLabel),
    ...mapTermResults(data.productTags?.nodes, "product_tag", t("search.type.product_tag"), "shop/tag", normalizeLabel),
    ...mapTermResults(data.productBrands?.nodes, "product_brand", t("search.type.product_brand"), "shop/brand", normalizeLabel),
    ...mapAuthorResults(data.authors?.nodes, languagePrefix, t("search.type.author"), normalizeLabel),
    ...mapContentResults(data.communityPosts?.nodes, "community_post", t("search.type.community_post"), normalizeLabel, (node) =>
      resolveCanonicalPath(`${languagePrefix}/community_post`, node.slug, node.uri)),
    ...mapTermResults(
      data.communityTags?.nodes,
      "community_tag",
      t("search.type.community_tag"),
      `${languagePrefix}/community-tag`,
      normalizeLabel,
    ),
    ...mapCommunityMembers(
      data.communityMembers,
      query,
      languagePrefix,
      t("search.type.community_author"),
      normalizeLabel,
    ),
  ];

  return dedupeSearchResults(results);
}

function mapContentResults(
  nodes: SearchNode[] | undefined,
  type: "product" | "post" | "page" | "community_post",
  subtitle: string,
  normalizeLabel: NormalizeLabel,
  hrefFor: (node: SearchNode) => string | null,
): SearchResultItem[] {
  return (nodes || []).flatMap((node) => {
    const title = normalizeLabel(node.name || node.title || "").trim();
    const href = hrefFor(node);
    return title && href ? [{ type, id: node.id, title, subtitle, href }] : [];
  });
}

function mapTermResults(
  nodes: SearchNode[] | undefined,
  type: Extract<SearchResultType, `${string}_category` | `${string}_tag` | "product_brand">,
  subtitle: string,
  routeBase: string,
  normalizeLabel: NormalizeLabel,
): SearchResultItem[] {
  return (nodes || []).flatMap((node) => {
    const title = normalizeLabel(node.name || "").trim();
    const href = resolveCanonicalPath(routeBase, node.slug, node.uri);
    return title && href ? [{ type, id: node.id, title, subtitle, href }] : [];
  });
}

function mapAuthorResults(
  nodes: SearchAuthorNode[] | undefined,
  languagePrefix: string,
  subtitle: string,
  normalizeLabel: NormalizeLabel,
): SearchResultItem[] {
  return (nodes || []).flatMap((node) => {
    const title = normalizeLabel(node.name || "").trim();
    const slug = normalizePathSegment(node.slug);
    if (!title || !slug) return [];
    return [{
      type: "author",
      id: node.id,
      title,
      subtitle,
      href: `${languagePrefix}/author/${slug}`,
    }];
  });
}

function mapCommunityMembers(
  nodes: SearchCommunityMemberNode[] | null,
  query: string,
  languagePrefix: string,
  subtitle: string,
  normalizeLabel: NormalizeLabel,
): SearchResultItem[] {
  const needle = normalizeSearchText(query, normalizeLabel);
  if (!needle) return [];

  return (nodes || []).flatMap((node) => {
    if (node.communityProfilePublic !== true) return [];
    const handle = normalizeCommunityHandle(node.communityHandle);
    const title = normalizeLabel(node.name || "").trim();
    const searchable = normalizeSearchText(`${title} ${handle} ${node.description || ""}`, normalizeLabel);
    if (!title || !handle || handle.includes("/") || !searchable.includes(needle)) return [];
    return [{
      type: "community_author",
      id: String(node.databaseId),
      title,
      subtitle,
      href: `${languagePrefix}/community/${encodeURIComponent(handle)}`,
    }];
  });
}

function dedupeSearchResults(results: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.href.replace(/\/+$/, "").toLocaleLowerCase("en-US");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contentPath(base: string, slug: string | null): string {
  const segment = normalizePathSegment(slug);
  const normalizedBase = base.replace(/^\/+|\/+$/g, "");
  return segment ? `/${normalizedBase ? `${normalizedBase}/` : ""}${segment}` : "";
}

function resolveInternalHref(uri: string | null, fallback: string): string | null {
  const candidate = uri?.trim() || fallback;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback || null;
  return candidate;
}

function resolveCanonicalPath(base: string, slug: string | null, uri: string | null): string | null {
  const canonical = contentPath(base, slug);
  return canonical || resolveInternalHref(uri, "");
}

function normalizePathSegment(value: string | null): string {
  if (!value) return "";
  try {
    return encodeURIComponent(decodeURIComponent(value).trim());
  } catch {
    return "";
  }
}

function normalizeLanguagePrefix(value: string): string {
  const language = value.trim().toLocaleLowerCase("en-US");
  return /^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(language) ? `/${language}` : "";
}

function normalizeSearchText(value: string, normalizeLabel: NormalizeLabel): string {
  return normalizeLabel(value).normalize("NFC").toLocaleLowerCase("en-US").trim();
}
