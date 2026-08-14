import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_OPTIONS, shouldRenderLanguageSwitcher, type LanguageOption } from "./options";

type LanguageContextValue = {
  languageCode: string;
  languageBackendCode: string;
  hasBackendLanguageOptions: boolean;
  canSwitchLanguage: boolean;
  hasLanguagePreference: boolean;
  languageSelectionRevision: number;
  setLanguageCode: (languageCode: string) => void;
  setLanguageCodeFromRoute: (languageCode: string) => void;
  syncLanguageCode: (languageCode: string) => void;
  languageOptions: LanguageOption[];
  configuredLanguageCodes: string[];
  syncLanguageOptions: (options: LanguageOption[]) => void;
};

const STORAGE_KEY = "funkycommerce-language";
const BACKEND_OPTIONS_STORAGE_KEY = "funkycommerce-language-options";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(languageOptions: LanguageOption[]): { languageCode: string; hasLanguagePreference: boolean } {
  if (typeof window === "undefined") {
    return { languageCode: languageOptions[0]?.code || LANGUAGE_OPTIONS[0].code, hasLanguagePreference: false };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.toLowerCase();
    if (stored && languageOptions.some(({ code }) => code === stored)) {
      return { languageCode: stored, hasLanguagePreference: true };
    }
  } catch {
    // The switch remains session-only when storage is unavailable.
  }

  return { languageCode: languageOptions[0]?.code || LANGUAGE_OPTIONS[0].code, hasLanguagePreference: false };
}

export function readPersistedBackendLanguageOptions(): LanguageOption[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKEND_OPTIONS_STORAGE_KEY);
    if (raw === null) return null;
    const stored = JSON.parse(raw) as unknown;
    if (!Array.isArray(stored)) return null;
    return stored.filter((option): option is LanguageOption =>
      typeof option === "object"
      && option !== null
      && typeof option.code === "string"
      && typeof option.label === "string"
      && typeof option.flagCode === "string"
      && typeof option.backendCode === "string",
    );
  } catch {
    return null;
  }
}

export function persistBackendLanguageOptions(options: LanguageOption[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BACKEND_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // The options will be rediscovered during the next application bootstrap.
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [initialBackendOptions] = useState(readPersistedBackendLanguageOptions);
  const initialLanguageOptions = initialBackendOptions?.length ? initialBackendOptions : LANGUAGE_OPTIONS;
  const [language, setLanguage] = useState(() => getInitialLanguage(initialLanguageOptions));
  const [languageOptions, setLanguageOptions] = useState(initialLanguageOptions);
  const [hasBackendLanguageOptions, setHasBackendLanguageOptions] = useState(initialBackendOptions !== null);
  const [backendLanguageOptions, setBackendLanguageOptions] = useState(initialBackendOptions || []);
  const [languageSelectionRevision, setLanguageSelectionRevision] = useState(0);
  const setLanguageCode = useCallback((nextLanguageCode: string) => {
    const normalized = nextLanguageCode.toLowerCase();
    if (!languageOptions.some(({ code }) => code === normalized)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // The selected language still applies for the current session.
    }
    setLanguage({ languageCode: normalized, hasLanguagePreference: true });
    setLanguageSelectionRevision((revision) => revision + 1);
  }, [languageOptions]);
  const setLanguageCodeFromRoute = useCallback((nextLanguageCode: string) => {
    const normalized = nextLanguageCode.toLowerCase();
    if (!languageOptions.some(({ code }) => code === normalized)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // The route language still applies for the current session.
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
    const resolvedOptions = options.length ? options : [LANGUAGE_OPTIONS[0]];
    persistBackendLanguageOptions(options);
    setLanguageOptions(resolvedOptions);
    setBackendLanguageOptions(options);
    setHasBackendLanguageOptions(true);
    setLanguage((current) =>
      current.hasLanguagePreference
        || resolvedOptions.some(({ code }) => code === current.languageCode)
        ? current
        : { languageCode: resolvedOptions[0].code, hasLanguagePreference: false },
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
        canSwitchLanguage: hasBackendLanguageOptions
          && shouldRenderLanguageSwitcher(backendLanguageOptions),
        languageSelectionRevision,
        languageOptions,
        configuredLanguageCodes: backendLanguageOptions.map(({ code }) => code),
        setLanguageCode,
        setLanguageCodeFromRoute,
        syncLanguageCode,
        syncLanguageOptions,
      };
    },
    [backendLanguageOptions, hasBackendLanguageOptions, language, languageOptions, languageSelectionRevision, setLanguageCode, setLanguageCodeFromRoute, syncLanguageCode, syncLanguageOptions],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
