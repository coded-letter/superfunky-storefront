export type BackendLanguageRecord = {
  code: string;
  name: string;
  slug: string;
  isDefault?: boolean;
};

export type StorefrontLanguage = {
  code: string;
  label: string;
  backendCode: string;
};

export function mapBackendLanguages(languages: BackendLanguageRecord[]): StorefrontLanguage[] {
  return [...languages]
    .sort((left, right) => Number(right.isDefault === true) - Number(left.isDefault === true))
    .flatMap((language) => {
      const code = language.slug.trim().toLowerCase();
      const backendCode = language.code.trim().toUpperCase();
      if (!code || !backendCode) return [];
      return [{ code, label: language.name, backendCode }];
    });
}
