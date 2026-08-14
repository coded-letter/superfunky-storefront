export type SearchResultType =
  | "product"
  | "product_category"
  | "product_tag"
  | "product_brand"
  | "post"
  | "post_category"
  | "post_tag"
  | "author"
  | "page"
  | "community_post"
  | "community_author"
  | "community_tag";

export type SearchResultItem = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResultGroup = "catalog" | "editorial" | "community" | "pages";

export type GroupedSearchResults = {
  group: SearchResultGroup;
  items: SearchResultItem[];
};

const GROUP_ORDER: SearchResultGroup[] = ["catalog", "editorial", "community", "pages"];

export function searchResultGroup(type: SearchResultType): SearchResultGroup {
  if (type === "page") return "pages";
  if (type.startsWith("community_")) return "community";
  if (type === "post" || type === "post_category" || type === "post_tag" || type === "author") {
    return "editorial";
  }
  return "catalog";
}

export function groupSearchResults(
  results: SearchResultItem[],
  maxPerGroup = 3,
  maxPerType = 2,
): GroupedSearchResults[] {
  const groups = new Map<SearchResultGroup, SearchResultItem[]>();
  const typeCounts = new Map<SearchResultType, number>();

  for (const item of results) {
    const group = searchResultGroup(item.type);
    const groupItems = groups.get(group) || [];
    const typeCount = typeCounts.get(item.type) || 0;
    if (groupItems.length >= maxPerGroup || typeCount >= maxPerType) continue;
    groupItems.push(item);
    groups.set(group, groupItems);
    typeCounts.set(item.type, typeCount + 1);
  }

  return GROUP_ORDER.flatMap((group) => {
    const items = groups.get(group);
    return items?.length ? [{ group, items }] : [];
  });
}
