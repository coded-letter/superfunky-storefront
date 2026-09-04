type LanguagePage = {
  uri: string;
  languageCode: string;
  translations: {
    languageCode: string;
    uri: string;
  }[];
};

type ContentLanguageFallbackDependencies = {
  getPage: (uri: string) => Promise<LanguagePage | null>;
  getNodeInfo: (uri: string) => Promise<object | null>;
};

export function resolveConfiguredContentLanguage(
  contentLanguageCode: string | null | undefined,
  selectedLanguageCode: string,
  configuredLanguageCodes: readonly string[],
): string {
  const contentLanguage = contentLanguageCode?.trim().toLowerCase() || "";
  const selectedLanguage = selectedLanguageCode.trim().toLowerCase();
  const configuredLanguages = configuredLanguageCodes.map((code) => code.trim().toLowerCase());
  if (contentLanguage && (!configuredLanguages.length || configuredLanguages.includes(contentLanguage))) {
    return contentLanguage;
  }
  return selectedLanguage || configuredLanguages[0] || contentLanguage || "en";
}

export function getContentLanguageFallbackCandidates(
  pathname: string,
  configuredLanguageCodes: readonly string[],
): string[] {
  const languageCodes = [...new Set(
    configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean),
  )];
  const segments = pathname.split("/").filter(Boolean);
  const currentPrefix = segments[0]?.toLowerCase();
  const hasLanguagePrefix = Boolean(currentPrefix && languageCodes.includes(currentPrefix));
  const contentSegments = hasLanguagePrefix ? segments.slice(1) : segments;
  if (!contentSegments.length) return [];

  const trailingSlash = pathname.endsWith("/") ? "/" : "";
  const contentPath = contentSegments.join("/");
  const candidates = languageCodes
    .filter((code) => code !== currentPrefix)
    .map((code) => `/${code}/${contentPath}${trailingSlash}`);
  if (hasLanguagePrefix) {
    candidates.push(`/${contentPath}${trailingSlash}`);
  }

  return [...new Set(candidates)].filter((candidate) => !samePath(candidate, pathname));
}

export async function resolveContentLanguageFallback(
  pathname: string,
  selectedLanguageCode: string,
  configuredLanguageCodes: readonly string[],
  dependencies: ContentLanguageFallbackDependencies,
): Promise<string | null> {
  const selectedLanguage = selectedLanguageCode.trim().toLowerCase();
  const candidates = getContentLanguageFallbackCandidates(pathname, configuredLanguageCodes);

  // Every candidate is independent. Resolve the complete compatibility matrix in
  // one network round trip, then apply the original configured-language priority.
  const results = await Promise.all(candidates.map(async (candidate) => {
    const [page, node] = await Promise.allSettled([
      dependencies.getPage(candidate),
      dependencies.getNodeInfo(candidate),
    ]);
    return { candidate, page, node };
  }));

  for (const { candidate, page: pageResult, node: nodeResult } of results) {
    if (pageResult.status === "rejected") throw pageResult.reason;
    const page = pageResult.value;
    if (page) {
      const translation = page.translations.find(
        ({ languageCode }) => languageCode.toLowerCase() === selectedLanguage,
      );
      return toInternalPath(translation?.uri || page.uri || candidate);
    }

    if (nodeResult.status === "rejected") throw nodeResult.reason;
    if (nodeResult.value) {
      return candidate;
    }
  }

  return null;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => value === "/" ? value : value.replace(/\/+$/, "");
  return normalize(left) === normalize(right);
}

function toInternalPath(value: string): string {
  const parsed = new URL(value, "https://storefront.local");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
