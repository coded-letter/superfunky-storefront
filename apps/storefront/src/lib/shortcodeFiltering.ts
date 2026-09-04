type Term = { slug?: string };

export type FilterablePost = {
  id: string;
  slug: string;
  date: string;
  title: string;
  categories?: Term[];
  tags?: Term[];
  author: { slug?: string };
  authorDatabaseId?: number;
};

export function shortcodeFilterValues(value?: string): string[] {
  if (value === undefined || value.trim() === "") return [];
  return [...new Set(value.split(/[,\s|]+/).map(normalizeFilterValue).filter(Boolean))];
}

export function matchesShortcodeValues(candidates: Array<string | number | undefined>, value?: string): boolean {
  if (value === undefined || value.trim() === "") return true;
  const wanted = shortcodeFilterValues(value);
  if (!wanted.length) return false;
  const available = candidates.map((candidate) => normalizeFilterValue(String(candidate ?? ""))).filter(Boolean);
  return wanted.some((item) => available.includes(item));
}

export function matchesPostTaxonomy(
  post: Pick<FilterablePost, "categories" | "tags" | "author" | "authorDatabaseId">,
  attributes: Record<string, string | undefined>,
): boolean {
  return matchesShortcodeValues(post.categories?.map(({ slug }) => slug), attributes.category)
    && matchesShortcodeValues(post.tags?.map(({ slug }) => slug), attributes.tag)
    && matchesShortcodeValues([post.author.slug, post.authorDatabaseId], attributes.author);
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/[^\p{L}\p{N}-]/gu, "");
}
