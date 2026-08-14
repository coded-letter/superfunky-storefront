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

  for (const candidate of candidates) {
    const page = await dependencies.getPage(candidate);
    if (page) {
      const translation = page.translations.find(
        ({ languageCode }) => languageCode.toLowerCase() === selectedLanguage,
      );
      return toInternalPath(translation?.uri || page.uri || candidate);
    }

    if (await dependencies.getNodeInfo(candidate)) {
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
