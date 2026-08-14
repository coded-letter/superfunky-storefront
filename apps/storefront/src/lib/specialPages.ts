import type { CmsPage } from "./pages";

export async function resolveLocalizedSpecialPage(
  pageSlug: string,
  languageCode: string,
  getPageByUri: (uri: string) => Promise<CmsPage | null>,
): Promise<CmsPage | null> {
  const normalizedLanguage = languageCode.toLowerCase();
  const localizedPage = await getPageByUri(`/${normalizedLanguage}/${pageSlug}/`);
  if (localizedPage?.languageCode === normalizedLanguage) return localizedPage;

  const defaultPage = await getPageByUri(`/${pageSlug}/`);
  if (!defaultPage) return null;
  if (defaultPage.languageCode === normalizedLanguage) return defaultPage;

  const translation = defaultPage.translations.find(
    (candidate) => candidate.languageCode === normalizedLanguage,
  );
  return translation ? getPageByUri(translation.uri) : null;
}
