export type UiStringsMap = Record<string, string>;

export function resolveUiString(
  key: string,
  languageStrings: UiStringsMap,
  englishStrings: UiStringsMap,
  overrides: UiStringsMap = {},
  replacements?: Record<string, string | number>,
): string {
  const template = overrides[key] ?? languageStrings[key] ?? englishStrings[key] ?? key;
  if (!replacements) return template;
  return Object.entries(replacements).reduce(
    (value, [name, replacement]) => value.split(`{${name}}`).join(String(replacement)),
    template,
  );
}
