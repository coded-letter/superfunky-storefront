import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useCurrency, useLanguage, useUiStrings } from "@funky/ui";
import {
  DEFAULT_STOREFRONT_CONFIGURATION,
  getAiAssistantConfiguration,
  getNavigationData,
  type CmsNavigationData,
} from "../lib/navigation";
import { useIncrementalData, type IncrementalDataState } from "@funky/sdk/react";
import { setStripePublishableKey } from "../lib/stripe";
import { fetchGeolocation, isGeolocationBackendConfigured } from "../lib/geolocation";
import { navigationDataCacheKey } from "../lib/navigationCacheKey.mjs";

/** Best-effort mapping: ISO 3166-1 alpha-2 country code → ISO 4217 currency code.
 *  Covers the most-common e-commerce markets; falls back to baseCurrency otherwise. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD",
  CH: "CHF", NO: "NOK", SE: "SEK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  JP: "JPY", CN: "CNY", KR: "KRW", IN: "INR", SG: "SGD",
  HK: "HKD", TW: "TWD", TH: "THB", MY: "MYR", ID: "IDR",
  BR: "BRL", MX: "MXN", AR: "ARS",
  ZA: "ZAR", AE: "AED", SA: "SAR", TR: "TRY",
};

const NavigationDataContext = createContext<IncrementalDataState<CmsNavigationData> | null>(null);

/** Stable, referentially-identical placeholder used until the first real navigation
 *  response (cached or network) resolves and there is no last-known-good data to fall
 *  back to yet. Lets route children mount immediately instead of waiting on navigation
 *  (header/footer/config) — every consumer already treats an empty menu/default config
 *  the same way it treats "not loaded yet". */
const EMPTY_NAVIGATION_DATA: CmsNavigationData = {
  header: [],
  mobile: [],
  footer: [],
  languages: [],
  storefrontConfig: DEFAULT_STOREFRONT_CONFIGURATION,
  uiStrings: {},
};

export function NavigationDataProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { languageCode, syncLanguageOptions } = useLanguage();
  const { syncCurrencyOptions, setCurrencyCode, currencyOptions } = useCurrency();
  const { syncUiStrings } = useUiStrings();
  const rawState = useIncrementalData(
    navigationDataCacheKey(languageCode),
    () => getNavigationData(languageCode),
    enabled,
  );
  // Fetched in parallel with navigation data (not gated on `rawState.isLoading`) so
  // neither request waits on the other — the assistant config merges in whenever it
  // resolves, same as navigation data does.
  const assistantState = useIncrementalData(
    `navigation-assistant:v2:${languageCode}`,
    () => getAiAssistantConfiguration(languageCode),
    enabled,
  );
  const navigationReadyMarked = useRef(false);
  const lastResolvedData = useRef<CmsNavigationData | null>(null);
  if (rawState.data) lastResolvedData.current = rawState.data;
  const resolvedData = rawState.data || lastResolvedData.current;
  const state = useMemo<IncrementalDataState<CmsNavigationData>>(() => {
    const fallback = resolvedData || EMPTY_NAVIGATION_DATA;
    return {
      ...rawState,
      data: {
        header: Array.isArray(fallback.header) ? fallback.header : [],
        mobile: Array.isArray(fallback.mobile) ? fallback.mobile : [],
        footer: Array.isArray(fallback.footer) ? fallback.footer : [],
        languages: Array.isArray(fallback.languages) ? fallback.languages : [],
        storefrontConfig: {
          ...(fallback.storefrontConfig || DEFAULT_STOREFRONT_CONFIGURATION),
          ...(assistantState.data
            ? {
                aiAssistant: {
                  ...(fallback.storefrontConfig?.aiAssistant || DEFAULT_STOREFRONT_CONFIGURATION.aiAssistant),
                  ...assistantState.data,
                },
              }
            : {}),
        },
        uiStrings: fallback.uiStrings || {},
      },
    };
  }, [assistantState.data, rawState, resolvedData]);
  useLayoutEffect(() => {
    const languages = rawState.data?.languages;
    if (!rawState.isRevalidating && Array.isArray(languages)) syncLanguageOptions(languages);
  }, [rawState.data?.languages, rawState.isRevalidating, syncLanguageOptions]);
  useEffect(() => {
    const configuration = rawState.data?.storefrontConfig;
    if (configuration?.currencies.length) {
      syncCurrencyOptions(configuration.currencies, configuration.baseCurrency);
    }
  }, [rawState.data?.storefrontConfig, syncCurrencyOptions]);
  useEffect(() => {
    setStripePublishableKey(rawState.data?.storefrontConfig?.stripePublishableKey ?? null);
  }, [rawState.data?.storefrontConfig?.stripePublishableKey]);
  useLayoutEffect(() => {
    if (!rawState.isLoading) {
      syncUiStrings(languageCode, rawState.data?.uiStrings ?? {});
    }
  }, [languageCode, rawState.data?.uiStrings, rawState.isLoading, syncUiStrings]);
  // Records the first moment navigation data (header/footer/config) resolves — a
  // proxy for "is there enough data to render real navigation" independent of when
  // the rest of the shell finishes mounting.
  useEffect(() => {
    if (!rawState.isLoading && !navigationReadyMarked.current) {
      navigationReadyMarked.current = true;
      performance.mark("storefront:navigation-ready");
    }
  }, [rawState.isLoading]);
  // Auto-select currency from visitor country on first visit (no stored preference).
  // Runs once when currencies are available and backend geolocation is configured.
  useEffect(() => {
    if (!isGeolocationBackendConfigured || !currencyOptions.length) return;
    // Only auto-select when the user has no stored currency preference.
    const storedCurrency = typeof window !== "undefined"
      ? window.localStorage.getItem("funkycommerce-currency")
      : null;
    if (storedCurrency) return;
    fetchGeolocation().then(({ countryCode }) => {
      if (!countryCode) return;
      const suggestedCurrency = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
      if (suggestedCurrency && currencyOptions.some(({ code }) => code === suggestedCurrency)) {
        setCurrencyCode(suggestedCurrency);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyOptions.length > 0]);

  return (
    <NavigationDataContext.Provider value={state}>
      {children}
    </NavigationDataContext.Provider>
  );
}

export function useNavigationData(): IncrementalDataState<CmsNavigationData> {
  const context = useContext(NavigationDataContext);
  if (!context) throw new Error("useNavigationData must be used within NavigationDataProvider");
  return context;
}
