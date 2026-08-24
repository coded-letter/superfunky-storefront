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

export function NavigationDataProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { languageCode, syncLanguageOptions } = useLanguage();
  const { syncCurrencyOptions, setCurrencyCode, currencyOptions } = useCurrency();
  const { syncUiStrings } = useUiStrings();
  const rawState = useIncrementalData(
    `navigation-data:v13:${languageCode}`,
    () => getNavigationData(languageCode),
    enabled,
  );
  const assistantState = useIncrementalData(
    `navigation-assistant:v1:${languageCode}`,
    () => getAiAssistantConfiguration(languageCode),
    enabled && !rawState.isLoading,
  );
  const lastResolvedData = useRef<CmsNavigationData | null>(null);
  if (rawState.data) lastResolvedData.current = rawState.data;
  const resolvedData = rawState.data || lastResolvedData.current;
  const state = useMemo<IncrementalDataState<CmsNavigationData>>(() => ({
    ...rawState,
    data: resolvedData
      ? {
          header: Array.isArray(resolvedData.header) ? resolvedData.header : [],
          mobile: Array.isArray(resolvedData.mobile) ? resolvedData.mobile : [],
          footer: Array.isArray(resolvedData.footer) ? resolvedData.footer : [],
          languages: Array.isArray(resolvedData.languages) ? resolvedData.languages : [],
          storefrontConfig: {
            ...(resolvedData.storefrontConfig || DEFAULT_STOREFRONT_CONFIGURATION),
            ...(assistantState.data
              ? {
                  aiAssistant: {
                    ...(resolvedData.storefrontConfig?.aiAssistant || DEFAULT_STOREFRONT_CONFIGURATION.aiAssistant),
                    ...assistantState.data,
                  },
                }
              : {}),
          },
          uiStrings: resolvedData.uiStrings || {},
        }
      : null,
  }), [assistantState.data, rawState, resolvedData]);
  const canRenderChildren = !enabled || Boolean(state.data) || !rawState.isLoading;
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
  useEffect(() => {
    const uiStrings = rawState.data?.uiStrings;
    if (uiStrings && Object.keys(uiStrings).length) syncUiStrings(uiStrings);
  }, [rawState.data?.uiStrings, syncUiStrings]);
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
      {canRenderChildren ? children : null}
    </NavigationDataContext.Provider>
  );
}

export function useNavigationData(): IncrementalDataState<CmsNavigationData> {
  const context = useContext(NavigationDataContext);
  if (!context) throw new Error("useNavigationData must be used within NavigationDataProvider");
  return context;
}
