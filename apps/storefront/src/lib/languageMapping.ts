export type BackendLanguageRecord = {
  code: string;
  name: string;
  slug: string;
};

export type StorefrontLanguage = {
  code: string;
  label: string;
  backendCode: string;
};

export function mapBackendLanguages(languages: BackendLanguageRecord[]): StorefrontLanguage[] {
  return languages.flatMap((language) => {
    const code = language.slug.trim().toLowerCase();
    const backendCode = language.code.trim().toUpperCase();
    if (!code || !backendCode) return [];
    return [{ code, label: language.name, backendCode }];
  });
}
