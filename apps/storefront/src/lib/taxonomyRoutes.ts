import type { CommerceTaxonomy, CommerceTaxonomyIdentifierType } from "./commerce";

export type TaxonomyArchiveIdentifier = {
  identifier: string;
  idType: CommerceTaxonomyIdentifierType;
};

export function resolveTaxonomyArchiveIdentifier(
  pathname: string,
  routeSlug?: string,
): TaxonomyArchiveIdentifier {
  if (routeSlug) {
    return { identifier: decodePathSegment(routeSlug), idType: "SLUG" };
  }

  return { identifier: normalizeTaxonomyUri(pathname), idType: "URI" };
}

export function normalizeTaxonomyUri(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const normalizedSegments = withLeadingSlash
    .split("/")
    .map((segment) => encodePathSegment(segment))
    .join("/")
    .replace(/\/+/g, "/");
  return normalizedSegments.endsWith("/") ? normalizedSegments : `${normalizedSegments}/`;
}

export function taxonomyNotFoundMessage(taxonomy: CommerceTaxonomy): string {
  if (taxonomy === "category") return "No products found in this category.";
  if (taxonomy === "tag") return "No products found with this tag.";
  return "No products found for this brand.";
}

export function taxonomyEmptyMessage(taxonomy: CommerceTaxonomy): string {
  if (taxonomy === "category") return "No products found in this category.";
  if (taxonomy === "tag") return "No products found with this tag.";
  return "No products found for this brand.";
}

function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
