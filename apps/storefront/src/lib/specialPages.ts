import type { CmsPage } from "./pages";

export async function resolveLocalizedSpecialPage(
  pageSlug: string,
  languageCode: string,
  getPageByUri: (uri: string) => Promise<CmsPage | null>,
): Promise<CmsPage | null> {
  const normalizedLanguage = languageCode.toLowerCase();
  const candidateSlugs = pageSlug === "404" ? ["404", "4o4"] : [pageSlug];

  for (const candidateSlug of candidateSlugs) {
    const localizedPage = await getPageByUri(`/${normalizedLanguage}/${candidateSlug}/`);
    if (localizedPage?.languageCode === normalizedLanguage) return localizedPage;

    const defaultPage = await getPageByUri(`/${candidateSlug}/`);
    if (!defaultPage) continue;
    if (defaultPage.languageCode === normalizedLanguage) return defaultPage;

    const translation = defaultPage.translations.find(
      (candidate) => candidate.languageCode === normalizedLanguage,
    );
    if (translation) return getPageByUri(translation.uri);
  }

  return null;
}
