// Icon assets are served from `apps/storefront/public/icons/**`, mirrored from the
// canonical `assets/icons_svgs` set (flags, payment providers, social platforms).
const ICON_BASE = "/icons";

/**
 * A handful of language flag files are keyed by language code rather than country
 * code (e.g. "EN", "EL", "JA" for English, Greek, Japanese) — these are the few
 * cases where a straight `code.toUpperCase()` lookup would not be correct. Extend
 * this table if a new language is added whose flag file uses a different key.
 */
const LANGUAGE_FLAG_OVERRIDES: Record<string, string> = {
  zh: "CN",
  ko: "KR",
  sv: "SE",
};

/** Resolves a language code to its flag icon file code ("smart mapping" with overrides). */
export function getLanguageFlagCode(languageCode: string): string {
  const normalized = languageCode.toLowerCase();
  return LANGUAGE_FLAG_OVERRIDES[normalized] ?? languageCode.toUpperCase();
}

export function flagIconSrc(flagCode: string): string {
  return `${ICON_BASE}/flags/${flagCode.toUpperCase()}.svg`;
}

export function socialIconSrc(key: string): string {
  return `${ICON_BASE}/social/${key}.svg`;
}

export function paymentIconSrc(key: string): string {
  return `${ICON_BASE}/payment/${key}.svg`;
}

export const SOCIAL_PLATFORM_OPTIONS = [
  { key: "behance", label: "Behance" },
  { key: "discord", label: "Discord" },
  { key: "facebook", label: "Facebook" },
  { key: "github", label: "GitHub" },
  { key: "google", label: "Google" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "patreon", label: "Patreon" },
  { key: "slack", label: "Slack" },
  { key: "tiktok", label: "TikTok" },
  { key: "twitch", label: "Twitch" },
  { key: "twitter", label: "Twitter" },
  { key: "x", label: "X (Twitter)" },
  { key: "youtube", label: "YouTube" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORM_OPTIONS)[number]["key"];

export function isSupportedSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORM_OPTIONS.some(({ key }) => key === value);
}

export type LanguageOption = {
  code: string;
  label: string;
  flagCode: string;
  /** Exact enum code advertised by the active GraphQL backend. */
  backendCode: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", flagCode: getLanguageFlagCode("en"), backendCode: "EN" },
  { code: "de", label: "Deutsch", flagCode: getLanguageFlagCode("de"), backendCode: "DE" },
  { code: "fr", label: "Français", flagCode: getLanguageFlagCode("fr"), backendCode: "FR" },
  { code: "es", label: "Español", flagCode: getLanguageFlagCode("es"), backendCode: "ES" },
  { code: "it", label: "Italiano", flagCode: getLanguageFlagCode("it"), backendCode: "IT" },
  { code: "pt", label: "Português", flagCode: getLanguageFlagCode("pt"), backendCode: "PT" },
  { code: "nl", label: "Nederlands", flagCode: getLanguageFlagCode("nl"), backendCode: "NL" },
  { code: "pl", label: "Polski", flagCode: getLanguageFlagCode("pl"), backendCode: "PL" },
  { code: "el", label: "Ελληνικά", flagCode: getLanguageFlagCode("el"), backendCode: "EL" },
  { code: "ja", label: "日本語", flagCode: getLanguageFlagCode("ja"), backendCode: "JA" },
];

export function resolveBootstrapLanguageOptions(
  persistedBackendOptions: LanguageOption[] | null,
  documentLanguage: string | null | undefined,
): LanguageOption[] {
  if (persistedBackendOptions === null) return LANGUAGE_OPTIONS;
  if (persistedBackendOptions.length) return persistedBackendOptions;

  const renderedLanguage = documentLanguage?.split("-")[0]?.toLowerCase();
  return [
    LANGUAGE_OPTIONS.find(({ code }) => code === renderedLanguage)
      ?? LANGUAGE_OPTIONS[0],
  ];
}

export function resolveInitialLanguage(
  storedLanguage: string | null | undefined,
  documentLanguage: string | null | undefined,
  languageOptions: LanguageOption[],
): { languageCode: string; hasLanguagePreference: boolean } {
  const stored = storedLanguage?.toLowerCase();
  if (stored && languageOptions.some(({ code }) => code === stored)) {
    return { languageCode: stored, hasLanguagePreference: true };
  }

  const rendered = documentLanguage?.split("-")[0]?.toLowerCase();
  if (rendered && languageOptions.some(({ code }) => code === rendered)) {
    return { languageCode: rendered, hasLanguagePreference: false };
  }

  return { languageCode: languageOptions[0]?.code || LANGUAGE_OPTIONS[0].code, hasLanguagePreference: false };
}

export function shouldRenderLanguageSwitcher(languageOptions: readonly LanguageOption[]): boolean {
  return languageOptions.length >= 2;
}

export function resolveSyncedLanguageCode(
  currentLanguageCode: string,
  hasLanguagePreference: boolean,
  languageOptions: readonly LanguageOption[],
): string {
  if (
    hasLanguagePreference
    && languageOptions.some(({ code }) => code === currentLanguageCode)
  ) {
    return currentLanguageCode;
  }
  return languageOptions[0]?.code || currentLanguageCode;
}

export type CurrencyOption = {
  code: string;
  label: string;
  symbol: string;
  icon?: string;
  rate?: number;
};

// Currencies are shared across many countries/languages (e.g. EUR spans the eurozone),
// so a single flag per currency would be misleading — the code + symbol is sufficient.
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "PLN", label: "Polish Złoty", symbol: "zł" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "BTC", label: "Bitcoin", symbol: "₿" },
  { code: "ETH", label: "Ethereum", symbol: "Ξ" },
];

export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  label: string;
  href: string;
  icon: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { id: "instagram", platform: "instagram", label: "Instagram", href: "https://instagram.com", icon: socialIconSrc("instagram") },
  { id: "x", platform: "x", label: "X (Twitter)", href: "https://x.com", icon: socialIconSrc("x") },
  { id: "twitter", platform: "twitter", label: "Twitter", href: "https://twitter.com", icon: socialIconSrc("twitter") },
  { id: "facebook", platform: "facebook", label: "Facebook", href: "https://facebook.com", icon: socialIconSrc("facebook") },
  { id: "youtube", platform: "youtube", label: "YouTube", href: "https://youtube.com", icon: socialIconSrc("youtube") },
  { id: "github", platform: "github", label: "GitHub", href: "https://github.com", icon: socialIconSrc("github") },
  { id: "linkedin", platform: "linkedin", label: "LinkedIn", href: "https://linkedin.com", icon: socialIconSrc("linkedin") },
  { id: "google", platform: "google", label: "Google", href: "https://g.page", icon: socialIconSrc("google") },
  { id: "discord", platform: "discord", label: "Discord", href: "https://discord.gg", icon: socialIconSrc("discord") },
  { id: "slack", platform: "slack", label: "Slack", href: "https://slack.com", icon: socialIconSrc("slack") },
  { id: "tiktok", platform: "tiktok", label: "TikTok", href: "https://www.tiktok.com", icon: socialIconSrc("tiktok") },
  { id: "twitch", platform: "twitch", label: "Twitch", href: "https://twitch.tv", icon: socialIconSrc("twitch") },
  { id: "behance", platform: "behance", label: "Behance", href: "https://www.behance.net", icon: socialIconSrc("behance") },
  { id: "patreon", platform: "patreon", label: "Patreon", href: "https://www.patreon.com", icon: socialIconSrc("patreon") },
];

export type PaymentMethod = {
  key: string;
  label: string;
  icon: string;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  { key: "visa", label: "Visa", icon: paymentIconSrc("visa") },
  { key: "mastercard", label: "Mastercard", icon: paymentIconSrc("mastercard") },
  { key: "paypal", label: "PayPal", icon: paymentIconSrc("paypal") },
  { key: "apay", label: "Apple Pay", icon: paymentIconSrc("apay") },
  { key: "gpay", label: "Google Pay", icon: paymentIconSrc("gpay") },
  { key: "stripe", label: "Stripe", icon: paymentIconSrc("stripe") },
  { key: "blik", label: "BLIK", icon: paymentIconSrc("blik") },
  { key: "btc", label: "Bitcoin", icon: paymentIconSrc("btc") },
  { key: "eth", label: "Ethereum", icon: paymentIconSrc("eth") },
];

export type AuthProvider = {
  key: string;
  label: string;
  icon: string;
};

export const AUTH_PROVIDERS: AuthProvider[] = [
  { key: "google", label: "Google", icon: socialIconSrc("google") },
  { key: "github", label: "GitHub", icon: socialIconSrc("github") },
  { key: "facebook", label: "Facebook", icon: socialIconSrc("facebook") },
];
