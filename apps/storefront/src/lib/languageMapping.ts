export type BackendLanguageRecord = {
  code: string;
  name: string;
  slug: string;
  isDefault?: boolean;
};

export type BackendSiteLanguageRecord = {
  code: string;
  name: string;
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

export function mapBackendSiteLanguages(languages: BackendSiteLanguageRecord[]): StorefrontLanguage[] {
  return languages.flatMap((language) => {
    const code = language.code.trim().toLowerCase();
    const label = language.name.trim();
    return code && label
      ? [{ code, label, backendCode: code.toUpperCase() }]
      : [];
  });
}
