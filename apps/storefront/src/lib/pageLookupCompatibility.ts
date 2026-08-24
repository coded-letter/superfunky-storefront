type PageLookupCandidate = {
  slug: string;
  uri: string | null;
};

export function normalizePageLookupUri(uri: string): string {
  let decodedUri = uri;
  try {
    decodedUri = decodeURIComponent(uri);
  } catch {
    // Preserve malformed user input so it remains a non-matching route.
  }
  const pathname = decodedUri.startsWith("/") ? decodedUri : `/${decodedUri}`;
  return pathname === "/" || pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function createCompatiblePageLookupQuery(query: string): string {
  return query
    .replace(/\(\s*\$name:\s*String!\s*\)/g, "")
    .replace(/,\s*where:\s*\{[^{}]*\}/g, "")
    .replace(/pages\(first:\s*10\b/g, "pages(first: 100");
}

export function selectPageLookupCandidate<T extends PageLookupCandidate>(
  candidates: readonly T[],
  normalizedUri: string,
  slug: string,
  requireExactUri = false,
): T | null {
  const exactMatch = candidates.find((candidate) =>
    candidate.uri ? normalizePageLookupUri(candidate.uri) === normalizedUri : false
  );
  if (requireExactUri) return exactMatch || null;
  const slugMatch = candidates.find((candidate) => candidate.slug === slug);
  return exactMatch || slugMatch || (candidates.length === 1 ? candidates[0] : null);
}
