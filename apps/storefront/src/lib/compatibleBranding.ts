export type CompatibleBranding = {
  storeName: string;
  companyName: string;
  tagline: string;
  logoUrl: string | null;
  iconUrl: string | null;
  promoHtml: string;
};

export type CompatibleBrandingQueryResult = {
  generalSettings: {
    title: string | null;
    description: string | null;
  } | null;
  storefrontConfig: {
    branding: Partial<CompatibleBranding> | null;
  } | null;
};

export function resolveCompatibleBranding(
  data: CompatibleBrandingQueryResult | null | undefined,
  defaults: CompatibleBranding,
): CompatibleBranding {
  const branding = data?.storefrontConfig?.branding;
  const siteTitle = data?.generalSettings?.title?.trim() || "";
  const siteTagline = data?.generalSettings?.description?.trim() || "";
  const configuredValue = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

  return {
    storeName: configuredValue(branding?.storeName) || siteTitle || defaults.storeName,
    companyName: configuredValue(branding?.companyName) || siteTitle || defaults.companyName,
    tagline: configuredValue(branding?.tagline) || siteTagline || defaults.tagline,
    logoUrl: configuredValue(branding?.logoUrl) || null,
    iconUrl: configuredValue(branding?.iconUrl) || null,
    promoHtml: typeof branding?.promoHtml === "string" ? branding.promoHtml : "",
  };
}
