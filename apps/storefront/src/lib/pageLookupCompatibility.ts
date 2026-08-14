type PageLookupCandidate = {
  slug: string;
  uri: string | null;
};

export function createCompatiblePageLookupQuery(query: string): string {
  return query
    .replace(/\(\s*\$name:\s*String!\s*\)/g, "")
    .replace(/,\s*where:\s*\{[^{}]*\}/g, "");
}

export function selectPageLookupCandidate<T extends PageLookupCandidate>(
  candidates: readonly T[],
  normalizedUri: string,
  slug: string,
): T | null {
  const exactMatch = candidates.find((candidate) =>
    candidate.uri ? normalizeUri(candidate.uri) === normalizedUri : false
  );
  const slugMatch = candidates.find((candidate) => candidate.slug === slug);
  return exactMatch || slugMatch || (candidates.length === 1 ? candidates[0] : null);
}

function normalizeUri(uri: string): string {
  const pathname = uri.startsWith("/") ? uri : `/${uri}`;
  return pathname === "/" || pathname.endsWith("/") ? pathname : `${pathname}/`;
}
