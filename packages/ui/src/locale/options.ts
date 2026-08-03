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

export type CurrencyOption = {
  code: string;
  label: string;
  symbol: string;
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
];

export type SocialLink = {
  key: string;
  label: string;
  href: string;
  icon: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { key: "instagram", label: "Instagram", href: "https://instagram.com", icon: socialIconSrc("instagram") },
  { key: "x", label: "X (Twitter)", href: "https://x.com", icon: socialIconSrc("x") },
  { key: "twitter", label: "Twitter", href: "https://twitter.com", icon: socialIconSrc("twitter") },
  { key: "facebook", label: "Facebook", href: "https://facebook.com", icon: socialIconSrc("facebook") },
  { key: "youtube", label: "YouTube", href: "https://youtube.com", icon: socialIconSrc("youtube") },
  { key: "github", label: "GitHub", href: "https://github.com", icon: socialIconSrc("github") },
  { key: "linkedin", label: "LinkedIn", href: "https://linkedin.com", icon: socialIconSrc("linkedin") },
  { key: "google", label: "Google", href: "https://g.page", icon: socialIconSrc("google") },
  { key: "discord", label: "Discord", href: "https://discord.gg", icon: socialIconSrc("discord") },
  { key: "slack", label: "Slack", href: "https://slack.com", icon: socialIconSrc("slack") },
  { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com", icon: socialIconSrc("tiktok") },
  { key: "twitch", label: "Twitch", href: "https://twitch.tv", icon: socialIconSrc("twitch") },
  { key: "behance", label: "Behance", href: "https://www.behance.net", icon: socialIconSrc("behance") },
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
