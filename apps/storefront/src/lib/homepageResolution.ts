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
  defaultLanguageCode = frontPage.languageCode,
): number | null {
  const configuredCodes = [...new Set(
    configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean),
  )];
  const requestedCode = requestedLanguageCode.trim().toLowerCase();
  if (configuredCodes.length && !configuredCodes.includes(requestedCode)) return null;
  const sourceCode = frontPage.languageCode.trim().toLowerCase();
  const translationCodes = new Set(
    frontPage.translations.map(({ languageCode }) => languageCode.trim().toLowerCase()),
  );
  const fallbackDefaultCode = defaultLanguageCode.trim().toLowerCase();
  const resolvedSourceCode = sourceCode === fallbackDefaultCode || translationCodes.has(fallbackDefaultCode)
    ? sourceCode
    : fallbackDefaultCode;
  if (resolvedSourceCode === requestedCode) return frontPage.databaseId;

  return frontPage.translations.find(
    (translation) => translation.languageCode.toLowerCase() === requestedCode,
  )?.databaseId ?? null;
}
