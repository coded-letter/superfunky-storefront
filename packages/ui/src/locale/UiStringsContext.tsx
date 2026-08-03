import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "./LanguageContext";
import enStrings from "./en.json";
import plStrings from "./pl.json";

type UiStringsMap = Record<string, string>;

const BUILTIN_STRINGS: Record<string, UiStringsMap> = {
  en: enStrings,
  pl: plStrings,
};

type UiStringsContextValue = {
  /** Translate a key, with optional named placeholder substitutions.
   *  Falls back to the English string, then the bare key. */
  t: (key: string, replacements?: Record<string, string | number>) => string;
  /** Called by navigation data loader to merge in backend-supplied overrides. */
  syncUiStrings: (overrides: UiStringsMap) => void;
};

const UiStringsContext = createContext<UiStringsContextValue | null>(null);

function applyReplacements(
  template: string,
  replacements?: Record<string, string | number>,
): string {
  if (!replacements) return template;
  return Object.entries(replacements).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    template,
  );
}

export function UiStringsProvider({ children }: { children: ReactNode }) {
  const { languageCode } = useLanguage();
  const [overrides, setOverrides] = useState<UiStringsMap>({});

  const syncUiStrings = useCallback((next: UiStringsMap) => {
    setOverrides((current) => {
      const isSame =
        Object.keys(next).length === Object.keys(current).length &&
        Object.entries(next).every(([k, v]) => current[k] === v);
      return isSame ? current : next;
    });
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>): string => {
      const lang = languageCode.toLowerCase().split("-")[0];
      const builtIn = BUILTIN_STRINGS[lang] ?? BUILTIN_STRINGS["en"];
      const raw = overrides[key] ?? builtIn?.[key] ?? BUILTIN_STRINGS["en"]?.[key] ?? key;
      return applyReplacements(raw, replacements);
    },
    [languageCode, overrides],
  );

  const value = useMemo(() => ({ t, syncUiStrings }), [t, syncUiStrings]);

  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>;
}

export function useUiStrings() {
  const ctx = useContext(UiStringsContext);
  if (!ctx) throw new Error("useUiStrings must be used within UiStringsProvider");
  return ctx;
}

/** Convenience alias — returns just the translate function. */
export function useT() {
  return useUiStrings().t;
}
