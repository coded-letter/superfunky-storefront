function normalizePathname(pathname: string): string {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withLeadingSlash === "/") return "/";
  return withLeadingSlash.replace(/\/+$/, "");
}

export function matchesStorefrontFallbackPath(
  pathname: string,
  fallback: string,
  routeLanguage?: string,
): boolean {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedFallback = normalizePathname(fallback);
  if (normalizedPathname === normalizedFallback) return true;
  if (!routeLanguage) return false;

  return normalizedPathname === normalizePathname(`/${routeLanguage}${normalizedFallback}`);
}
