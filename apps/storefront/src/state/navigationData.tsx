import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useCurrency, useLanguage, useUiStrings } from "@funky/ui";
import { DEFAULT_STOREFRONT_CONFIGURATION, getNavigationData, type CmsNavigationData } from "../lib/navigation";
import { useIncrementalData, type IncrementalDataState } from "../lib/incrementalData";
import { setStripePublishableKey } from "../lib/stripe";
import { fetchGeolocation, isGeolocationBackendConfigured } from "../lib/geolocation";
import { isBackendConfigured } from "../lib/env";

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

export function NavigationDataProvider({ children }: { children: ReactNode }) {
  const { languageCode, hasBackendLanguageOptions, syncLanguageOptions } = useLanguage();
  const { syncCurrencyOptions, setCurrencyCode, currencyOptions } = useCurrency();
  const { syncUiStrings } = useUiStrings();
  const rawState = useIncrementalData(
    `navigation-data:v7:${languageCode}`,
    () => getNavigationData(languageCode),
  );
  const state = useMemo<IncrementalDataState<CmsNavigationData>>(() => ({
    ...rawState,
    data: rawState.data
      ? {
          header: Array.isArray(rawState.data.header) ? rawState.data.header : [],
          mobile: Array.isArray(rawState.data.mobile) ? rawState.data.mobile : [],
          footer: Array.isArray(rawState.data.footer) ? rawState.data.footer : [],
          languages: Array.isArray(rawState.data.languages) ? rawState.data.languages : [],
          storefrontConfig: rawState.data.storefrontConfig || DEFAULT_STOREFRONT_CONFIGURATION,
          uiStrings: rawState.data.uiStrings || {},
        }
      : null,
  }), [rawState]);
  useEffect(() => {
    const languages = state.data?.languages;
    if (!state.isRevalidating && Array.isArray(languages) && languages.length) syncLanguageOptions(languages);
  }, [state.data?.languages, state.isRevalidating, syncLanguageOptions]);
  useEffect(() => {
    const configuration = state.data?.storefrontConfig;
    if (configuration?.currencies.length) {
      syncCurrencyOptions(configuration.currencies, configuration.baseCurrency);
    }
  }, [state.data?.storefrontConfig, syncCurrencyOptions]);
  useEffect(() => {
    setStripePublishableKey(state.data?.storefrontConfig?.stripePublishableKey ?? null);
  }, [state.data?.storefrontConfig?.stripePublishableKey]);
  useEffect(() => {
    const uiStrings = state.data?.uiStrings;
    if (uiStrings && Object.keys(uiStrings).length) syncUiStrings(uiStrings);
  }, [state.data?.uiStrings, syncUiStrings]);
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

  const isResolvingBackendLanguages = isBackendConfigured && !hasBackendLanguageOptions && !state.error;
  return (
    <NavigationDataContext.Provider value={state}>
      {isResolvingBackendLanguages ? null : children}
    </NavigationDataContext.Provider>
  );
}

export function useNavigationData(): IncrementalDataState<CmsNavigationData> {
  const context = useContext(NavigationDataContext);
  if (!context) throw new Error("useNavigationData must be used within NavigationDataProvider");
  return context;
}
