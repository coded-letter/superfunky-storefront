import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CURRENCY_OPTIONS, type CurrencyOption } from "./options";
import { useLanguage } from "./LanguageContext";

type CurrencyContextValue = {
  currencyCode: string;
  baseCurrency: string;
  currencyOptions: CurrencyOption[];
  selectedRate: number;
  formatBaseAmount: (amount: number) => string;
  convertSelectedToBase: (amount: number) => number;
  setCurrencyCode: (currencyCode: string) => void;
  syncCurrencyOptions: (options: CurrencyOption[], baseCurrency: string) => void;
};

const STORAGE_KEY = "funkycommerce-currency";
const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getStoredCurrencyCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.toUpperCase() || null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { languageCode } = useLanguage();
  const storedCurrencyCode = getStoredCurrencyCode();
  const [currency, setCurrency] = useState({
    code: storedCurrencyCode || CURRENCY_OPTIONS[0].code,
    hasPreference: Boolean(storedCurrencyCode),
  });
  const [baseCurrency, setBaseCurrency] = useState(CURRENCY_OPTIONS[0].code);
  const [currencyOptions, setCurrencyOptions] = useState(CURRENCY_OPTIONS);

  const setCurrencyCode = useCallback((nextCurrencyCode: string) => {
    const normalized = nextCurrencyCode.toUpperCase();
    if (!currencyOptions.some(({ code }) => code === normalized)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // The selection remains available for this browser session.
    }
    setCurrency({ code: normalized, hasPreference: true });
  }, [currencyOptions]);

  const syncCurrencyOptions = useCallback((options: CurrencyOption[], nextBaseCurrency: string) => {
    const normalizedBase = nextBaseCurrency.toUpperCase();
    const usableOptions = options.filter(({ code, rate }) => code === normalizedBase || (Number.isFinite(rate) && (rate ?? 0) > 0));
    if (!usableOptions.length) return;
    const fallbackCode = usableOptions.some(({ code }) => code === normalizedBase) ? normalizedBase : usableOptions[0].code;
    setCurrencyOptions(usableOptions);
    setBaseCurrency(fallbackCode);
    setCurrency((current) => {
      if (current.hasPreference && usableOptions.some(({ code }) => code === current.code)) return current;
      if (!current.hasPreference && current.code === fallbackCode) return current;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage availability does not affect the backend-derived fallback.
      }
      return { code: fallbackCode, hasPreference: false };
    });
  }, []);

  const selectedOption = currencyOptions.find(({ code }) => code === currency.code)
    || currencyOptions.find(({ code }) => code === baseCurrency)
    || currencyOptions[0];
  const selectedRate = selectedOption?.code === baseCurrency ? 1 : selectedOption?.rate || 1;
// Crypto assets use non-ISO-4217 codes — Intl.NumberFormat rejects them.
// Map each to its unicode symbol and appropriate decimal precision.
const CRYPTO_CURRENCY_FORMAT: Record<string, { symbol: string; decimals: number }> = {
  BTC: { symbol: "₿", decimals: 8 },
  ETH: { symbol: "Ξ", decimals: 6 },
};

  const formatBaseAmount = useCallback((amount: number) => {
    const converted = amount * selectedRate;
    const code = selectedOption?.code || baseCurrency;
    const crypto = CRYPTO_CURRENCY_FORMAT[code.toUpperCase()];
    if (crypto) {
      // Trim trailing zeros but keep at least 4 significant decimal places for readability.
      const formatted = converted.toFixed(crypto.decimals).replace(/\.?0+$/, "");
      return `${crypto.symbol}\u202F${formatted}`;
    }
    try {
      return new Intl.NumberFormat(languageCode, {
        style: "currency",
        currency: code,
      }).format(converted);
    } catch {
      return `${selectedOption?.symbol || code} ${converted.toFixed(2)}`;
    }
  }, [baseCurrency, languageCode, selectedOption?.code, selectedOption?.symbol, selectedRate]);
  const convertSelectedToBase = useCallback(
    (amount: number) => amount / selectedRate,
    [selectedRate],
  );

  const value = useMemo<CurrencyContextValue>(() => ({
    currencyCode: currency.code,
    baseCurrency,
    currencyOptions,
    selectedRate,
    formatBaseAmount,
    convertSelectedToBase,
    setCurrencyCode,
    syncCurrencyOptions,
  }), [baseCurrency, convertSelectedToBase, currency.code, currencyOptions, formatBaseAmount, selectedRate, setCurrencyCode, syncCurrencyOptions]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function parseLocalizedPrice(value: string): number | null {
  const normalized = value
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, "")
    .trim()
    .replace(/\s|\u00a0/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!normalized) return null;
  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  let numeric = normalized;
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    numeric = normalized.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else {
    const separator = commaIndex >= 0 ? "," : dotIndex >= 0 ? "." : "";
    if (separator) {
      const fractionalDigits = normalized.length - normalized.lastIndexOf(separator) - 1;
      numeric = fractionalDigits > 0 && fractionalDigits <= 2
        ? normalized.replace(separator, ".")
        : normalized.split(separator).join("");
    }
  }
  const amount = Number(numeric);
  return Number.isFinite(amount) ? amount : null;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
