export type HomePageReference = {
  databaseId: number;
  languageCode: string;
  translations: {
    databaseId: number;
    languageCode: string;
  }[];
};

export function resolveHomePageDatabaseId(
  frontPage: HomePageReference,
  requestedLanguageCode: string,
  configuredLanguageCodes: readonly string[],
): number | null {
  const configuredCodes = [...new Set(
    configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean),
  )];
  const requestedCode = requestedLanguageCode.trim().toLowerCase();
  if (configuredCodes.length && !configuredCodes.includes(requestedCode)) return null;
  if (frontPage.languageCode.toLowerCase() === requestedCode) return frontPage.databaseId;

  return frontPage.translations.find(
    (translation) => translation.languageCode.toLowerCase() === requestedCode,
  )?.databaseId ?? null;
}
