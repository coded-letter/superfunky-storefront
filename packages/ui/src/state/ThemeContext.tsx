import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

export type ThemeContextValue = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const STORAGE_KEY = "funkycommerce-mockup-theme";

function readStoredTheme(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // Fall back to the browser preference when storage access is unavailable.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(isDarkMode: boolean) {
  if (typeof document === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, isDarkMode ? "dark" : "light");
  // Toggle the `dark` class (and native `color-scheme`) on the root <html> element, not
  // just an inner wrapper — this is what the legacy prototype does (there via
  // document.body.classList), and it's required for anything that keys off document-level
  // state: native form controls, and OS/browser-rendered scrollbars in particular, which
  // only pick up a dark palette when `color-scheme` is set on the document root.
  document.documentElement.classList.toggle("dark", isDarkMode);
  document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(readStoredTheme);

  useLayoutEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode: () => setIsDarkMode((previous) => !previous) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
