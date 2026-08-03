import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_OPTIONS, type LanguageOption } from "./options";

type LanguageContextValue = {
  languageCode: string;
  languageBackendCode: string;
  hasBackendLanguageOptions: boolean;
  hasLanguagePreference: boolean;
  setLanguageCode: (languageCode: string) => void;
  syncLanguageCode: (languageCode: string) => void;
  languageOptions: LanguageOption[];
  syncLanguageOptions: (options: LanguageOption[]) => void;
};

const STORAGE_KEY = "funkycommerce-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): { languageCode: string; hasLanguagePreference: boolean } {
  if (typeof window === "undefined") {
    return { languageCode: LANGUAGE_OPTIONS[0].code, hasLanguagePreference: false };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.toLowerCase();
    if (stored && LANGUAGE_OPTIONS.some(({ code }) => code === stored)) {
      return { languageCode: stored, hasLanguagePreference: true };
    }
  } catch {
    // The switch remains session-only when storage is unavailable.
  }

  return { languageCode: LANGUAGE_OPTIONS[0].code, hasLanguagePreference: false };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [languageOptions, setLanguageOptions] = useState(LANGUAGE_OPTIONS);
  const [hasBackendLanguageOptions, setHasBackendLanguageOptions] = useState(false);
  const setLanguageCode = useCallback((nextLanguageCode: string) => {
    const normalized = nextLanguageCode.toLowerCase();
    if (!languageOptions.some(({ code }) => code === normalized)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // The selected language still applies for the current session.
    }
    setLanguage({ languageCode: normalized, hasLanguagePreference: true });
  }, [languageOptions]);
  const syncLanguageCode = useCallback((nextLanguageCode: string) => {
    const normalized = nextLanguageCode.toLowerCase();
    if (!languageOptions.some(({ code }) => code === normalized)) return;
    setLanguage((current) =>
      current.hasLanguagePreference || current.languageCode === normalized
        ? current
        : { languageCode: normalized, hasLanguagePreference: false },
    );
  }, [languageOptions]);
  const syncLanguageOptions = useCallback((options: LanguageOption[]) => {
    if (!options.length) return;
    setLanguageOptions(options);
    setHasBackendLanguageOptions(true);
    setLanguage((current) =>
      options.some(({ code }) => code === current.languageCode)
        ? current
        : { languageCode: options[0].code, hasLanguagePreference: false },
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = language.languageCode;
  }, [language.languageCode]);

  const value = useMemo(
    () => {
      const selectedLanguage = languageOptions.find(({ code }) => code === language.languageCode) ?? languageOptions[0];
      return {
        ...language,
        languageBackendCode: selectedLanguage.backendCode,
        hasBackendLanguageOptions,
        languageOptions,
        setLanguageCode,
        syncLanguageCode,
        syncLanguageOptions,
      };
    },
    [hasBackendLanguageOptions, language, languageOptions, setLanguageCode, syncLanguageCode, syncLanguageOptions],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
