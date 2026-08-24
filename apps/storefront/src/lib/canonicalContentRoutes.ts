type ContentTranslation = {
  languageCode: string;
  uri: string;
};

export function mergeKnownRoutes(
  sourceLanguageCode: string,
  sourceUri: string | null | undefined,
  pathname: string,
  translations: ContentTranslation[],
  existingRoutes: ContentTranslation[],
): ContentTranslation[] {
  const resolvedSourcePath = sourceUri ? toInternalPath(sourceUri) : pathname;
  const routes = new Map<string, ContentTranslation>();
  if (existingRoutes.some((route) =>
    samePath(toInternalPath(route.uri), pathname)
    || samePath(toInternalPath(route.uri), resolvedSourcePath)
  )) {
    for (const route of existingRoutes) {
      routes.set(route.languageCode.toLowerCase(), route);
    }
  }
  routes.set(sourceLanguageCode.toLowerCase(), {
    languageCode: sourceLanguageCode,
    uri: resolvedSourcePath,
  });
  for (const translation of translations) {
    routes.set(translation.languageCode.toLowerCase(), translation);
  }
  return [...routes.values()];
}

export function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => value === "/" ? value : value.replace(/\/+$/, "");
  return normalize(left) === normalize(right);
}

export function toInternalPath(url: string): string {
  try {
    const parsed = new URL(url, "https://storefront.invalid");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
