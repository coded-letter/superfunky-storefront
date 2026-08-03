/**
 * Converts a title into a URL-safe slug: strips diacritics, lowercases, and collapses
 * runs of non-alphanumeric characters into single hyphens. Kept dependency-free so it
 * can be unit tested in isolation (see `slugify.test.ts`).
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}
