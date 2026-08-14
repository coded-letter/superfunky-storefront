/** Premium companion configuration derived from the configured WordPress origin. */

import { restUrl } from "@funky/sdk";

export const ABANDONED_CART_ENDPOINT = restUrl("funkycommerce/v1/abandoned-carts");

export const isAbandonedCartBackendConfigured = Boolean(ABANDONED_CART_ENDPOINT);

export const ABANDONED_CART_CONFIG = {
  /** Idle time (ms) of no mouse/keyboard/touch/scroll activity before auto-submitting
   * on the checkout page. Set to 0 to disable idle tracking entirely. */
  IDLE_TIME_MS: 30_000,

  ACTIVITY_EVENTS: ["mousedown", "keydown", "scroll", "touchstart"] as const,

  /** Debounce window (ms) preventing duplicate submissions in quick succession. */
  SUBMISSION_DEBOUNCE_MS: 2_000,

  // Fallback symbol only — real shop currency now comes from the live WooCommerce
  // Store API (see `lib/currency.ts`); this is just what abandoned-cart total parsing
  // falls back to before that first live fetch resolves.
  CURRENCY_SYMBOL: "€",

  STORAGE_KEYS: {
    checkout: "funkycommerce-checkout-form",
    captureKey: "funkycommerce-abandoned-cart-capture-key",
  },

  SOURCES: {
    CHECKOUT_IDLE: "checkout_idle",
    CHECKOUT_FORM_CHANGE: "checkout_form_change",
    PAGE_UNLOAD_BEACON: "page_unload_beacon",
    MANUAL_TRIGGER: "manual_trigger",
  } as const,

  VALIDATION: {
    MIN_CART_ITEMS: 1,
    MIN_EMAIL_LENGTH: 5,
    MAX_EMAIL_LENGTH: 254,
  },

  INCLUDE_METADATA: {
    USER_AGENT: true,
    TIMESTAMP: true,
    URL: true,
  },
} as const;

export type AbandonedCartSource = (typeof ABANDONED_CART_CONFIG.SOURCES)[keyof typeof ABANDONED_CART_CONFIG.SOURCES];
export type AbandonedCartConsentMode = "explicit" | "legitimate_interest";

export type AbandonedCartPublicConfigSource = {
  configVersion?: string;
  restNamespace?: string;
  endpoints?: Partial<{
    headless: string;
    native: string;
    recovery: string;
    unsubscribe: string;
    compat: string;
    legacy: string;
    config: string;
  }>;
  origin?: Partial<{
    site: string;
    allowedOrigins: string[];
    strict: boolean;
  }>;
  capture?: Partial<{
    maxItems: number;
    maxQuantity: number;
    rateLimitWindow: number;
    rateLimitMax: number;
    nativeRateLimit: number;
    sessionNonce: string;
  }>;
  consent?: Partial<{
    modes: string[];
    required: boolean;
  }>;
  language?: Partial<{
    language: string;
    locale: string;
    defaultLanguage: string;
    defaultLocale: string;
    translated: boolean;
    fallbackUsed: boolean;
    polylang: boolean;
    available: Array<Partial<{
      language: string;
      locale: string;
      defaultLanguage: string;
      defaultLocale: string;
    }>>;
  }>;
  store?: Partial<{
    currency: string;
    cartUrl: string;
    recoveryWindow: number;
  }>;
  checkout?: Partial<{
    fieldId: string;
    fieldAttribute: string;
    enabled: boolean;
    mode: string;
    required: boolean;
    captureKey: string;
    nonce: string;
    debounceMs: number;
    idleMs: number;
    consentLabel: string;
  }>;
};

export type AbandonedCartPublicConfig = {
  configVersion: string;
  restNamespace: string;
  endpoints: {
    headless: string;
    native: string;
    recovery: string;
    unsubscribe: string;
    compat: string;
    legacy: string;
    config: string;
  };
  origin: {
    site: string;
    allowedOrigins: string[];
    strict: boolean;
  };
  capture: {
    maxItems: number;
    maxQuantity: number;
    rateLimitWindow: number;
    rateLimitMax: number;
    nativeRateLimit: number;
    sessionNonce: string;
  };
  consent: {
    modes: AbandonedCartConsentMode[];
    required: boolean;
  };
  language: {
    language: string;
    locale: string;
    defaultLanguage: string;
    defaultLocale: string;
    translated: boolean;
    fallbackUsed: boolean;
    polylang: boolean;
    available: Array<{
      language: string;
      locale: string;
      defaultLanguage: string;
      defaultLocale: string;
    }>;
  };
  store: {
    currency: string;
    cartUrl: string;
    recoveryWindow: number;
  };
  checkout: {
    fieldId: string;
    fieldAttribute: string;
    enabled: boolean;
    mode: AbandonedCartConsentMode;
    required: boolean;
    captureKey: string;
    nonce: string;
    debounceMs: number;
    idleMs: number;
    consentLabel: string;
  };
};

const RECOVERY_PARAM_KEYS = ["funkycommerce_recovery", "mode", "language", "locale"] as const;

function trimmed(value: string | undefined | null, maxLength: number): string {
  return (value || "").trim().slice(0, maxLength);
}

function normalizeLanguageCode(
  value: string | undefined | null,
  fallback: string,
  allowedLanguageCodes: readonly string[] = [],
): string {
  const candidate = trimmed(value, 40).toLowerCase();
  const normalizedFallback = trimmed(fallback, 40).toLowerCase();
  const allowed = new Set(allowedLanguageCodes.map((code) => code.toLowerCase()));
  const isValid = Boolean(candidate) && /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(candidate);
  if (isValid && (allowed.size === 0 || allowed.has(candidate))) return candidate;
  if (normalizedFallback && (allowed.size === 0 || allowed.has(normalizedFallback))) return normalizedFallback;
  return candidate || normalizedFallback || "en";
}

function normalizeMode(value: string | undefined | null): AbandonedCartConsentMode {
  return value === "legitimate_interest" ? "legitimate_interest" : "explicit";
}

function normalizeNonEmpty(value: string | undefined | null, fallback: string, maxLength = 500): string {
  const normalized = trimmed(value, maxLength);
  return normalized || fallback;
}

function normalizePositiveInteger(value: number | undefined | null, fallback: number, minimum = 1): number {
  const parsed = Number.isFinite(value as number) ? Math.trunc(Number(value)) : NaN;
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function normalizeConsentLabel(mode: AbandonedCartConsentMode, value: string | undefined | null): string {
  const fallback =
    mode === "legitimate_interest"
      ? "We will use your checkout email under legitimate interests to recover your cart."
      : "I consent to abandoned-cart recovery emails.";
  return normalizeNonEmpty(value, fallback, 300);
}

function normalizeUrl(value: string | undefined | null, fallback: string): string {
  const normalized = trimmed(value, 500);
  if (!normalized) return fallback;
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) return normalized;
  return fallback;
}

export function normalizeAbandonedCartPublicConfig(
  raw: AbandonedCartPublicConfigSource | null | undefined,
  fallback: {
    languageCode: string;
    locale: string;
    configuredLanguageCodes?: readonly string[];
  },
): AbandonedCartPublicConfig {
  const fallbackLanguage = trimmed(fallback.languageCode, 40).toLowerCase() || "en";
  const fallbackLocale = trimmed(fallback.locale, 40) || fallbackLanguage;
  const allowedLanguageCodes = fallback.configuredLanguageCodes ?? [];

  const mode = normalizeMode(raw?.checkout?.mode);
  const language = {
    language: normalizeLanguageCode(raw?.language?.language, fallbackLanguage, allowedLanguageCodes),
    locale: normalizeNonEmpty(raw?.language?.locale, fallbackLocale, 40),
    defaultLanguage: normalizeLanguageCode(raw?.language?.defaultLanguage, fallbackLanguage, allowedLanguageCodes),
    defaultLocale: normalizeNonEmpty(raw?.language?.defaultLocale, fallbackLocale, 40),
    translated: Boolean(raw?.language?.translated),
    fallbackUsed: Boolean(raw?.language?.fallbackUsed),
    polylang: Boolean(raw?.language?.polylang),
    available: (raw?.language?.available ?? []).flatMap((entry) => {
      const languageCode = normalizeLanguageCode(entry?.language, fallbackLanguage, allowedLanguageCodes);
      const locale = normalizeNonEmpty(entry?.locale, fallbackLocale, 40);
      const defaultLanguage = normalizeLanguageCode(entry?.defaultLanguage, languageCode, allowedLanguageCodes);
      const defaultLocale = normalizeNonEmpty(entry?.defaultLocale, locale, 40);
      if (!languageCode || !locale) return [];
      return [{ language: languageCode, locale, defaultLanguage, defaultLocale }];
    }),
  };

  return {
    configVersion: normalizeNonEmpty(raw?.configVersion, "1", 16),
    restNamespace: normalizeNonEmpty(raw?.restNamespace, "funkycommerce/v1", 64),
    endpoints: {
      headless: normalizeUrl(raw?.endpoints?.headless, ""),
      native: normalizeUrl(raw?.endpoints?.native, ""),
      recovery: normalizeUrl(raw?.endpoints?.recovery, ""),
      unsubscribe: normalizeUrl(raw?.endpoints?.unsubscribe, ""),
      compat: normalizeUrl(raw?.endpoints?.compat, ""),
      legacy: normalizeUrl(raw?.endpoints?.legacy, ""),
      config: normalizeUrl(raw?.endpoints?.config, ""),
    },
    origin: {
      site: normalizeUrl(raw?.origin?.site, ""),
      allowedOrigins: Array.isArray(raw?.origin?.allowedOrigins)
        ? raw.origin.allowedOrigins.map((origin) => normalizeUrl(origin, "")).filter(Boolean)
        : [],
      strict: raw?.origin?.strict !== false,
    },
    capture: {
      maxItems: normalizePositiveInteger(raw?.capture?.maxItems, 100, 1),
      maxQuantity: normalizePositiveInteger(raw?.capture?.maxQuantity, 1000, 1),
      rateLimitWindow: normalizePositiveInteger(raw?.capture?.rateLimitWindow, 600, 1),
      rateLimitMax: normalizePositiveInteger(raw?.capture?.rateLimitMax, 12, 1),
      nativeRateLimit: normalizePositiveInteger(raw?.capture?.nativeRateLimit, 8, 1),
      sessionNonce: normalizeNonEmpty(raw?.capture?.sessionNonce, "wp_rest", 32),
    },
    consent: {
      modes: [mode],
      required: raw?.consent?.required !== false,
    },
    language,
    store: {
      currency: normalizeNonEmpty(raw?.store?.currency, "", 16),
      cartUrl: normalizeUrl(raw?.store?.cartUrl, "/cart"),
      recoveryWindow: normalizePositiveInteger(raw?.store?.recoveryWindow, 30, 1),
    },
    checkout: {
      fieldId: normalizeNonEmpty(raw?.checkout?.fieldId, "funkycommerce-native-checkout/consent", 80),
      fieldAttribute: normalizeNonEmpty(raw?.checkout?.fieldAttribute, "data-funkycommerce-native-checkout-consent", 80),
      enabled: raw?.checkout?.enabled !== false,
      mode,
      required: mode === "explicit" ? true : Boolean(raw?.checkout?.required),
      captureKey: normalizeNonEmpty(raw?.checkout?.captureKey, "", 80),
      nonce: normalizeNonEmpty(raw?.checkout?.nonce, "wp_rest", 32),
      debounceMs: normalizePositiveInteger(raw?.checkout?.debounceMs, 2000, 0),
      idleMs: normalizePositiveInteger(raw?.checkout?.idleMs, 30000, 0),
      consentLabel: normalizeConsentLabel(mode, raw?.checkout?.consentLabel),
    },
  };
}

export function stripAbandonedCartRecoveryParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  RECOVERY_PARAM_KEYS.forEach((key) => next.delete(key));
  return next;
}

export function buildAbandonedCartRecoverySearch(searchParams: URLSearchParams): string {
  const cleaned = stripAbandonedCartRecoveryParams(searchParams);
  const serialized = cleaned.toString();
  return serialized ? `?${serialized}` : "";
}
