import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Configurable categories — mirrors the updated legacy prototype's consent shape
 * (`Functional` is always granted and isn't tracked here as a toggle). */
export type CookieCategory = "marketing" | "tracking" | "performance";

export type CookieConsent = Record<CookieCategory, boolean>;

const STORAGE_KEY = "funkycommerce-mockup-cookie-consent";

const ACCEPT_ALL_CONSENT: CookieConsent = { marketing: true, tracking: true, performance: true };
const REJECT_NON_ESSENTIAL_CONSENT: CookieConsent = { marketing: false, tracking: false, performance: false };

export type CookieConsentContextValue = {
  /** `null` until the visitor makes (or has previously made) a choice. */
  consent: CookieConsent | null;
  /** Whether the manage-preferences panel is currently expanded. */
  isManagerOpen: boolean;
  openManager: () => void;
  closeManager: () => void;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (consent: CookieConsent) => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConsent({
          marketing: Boolean(parsed.marketing),
          tracking: Boolean(parsed.tracking),
          performance: Boolean(parsed.performance),
        });
      }
    } catch {
      // Ignore malformed/unavailable storage — the banner will simply show again.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || !consent) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  }, [consent, isHydrated]);

  // Mirrors the legacy prototype's Escape-to-close behavior for the manager modal.
  useEffect(() => {
    if (!isManagerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsManagerOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isManagerOpen]);

  const value: CookieConsentContextValue = {
    consent,
    isManagerOpen,
    openManager: () => setIsManagerOpen(true),
    closeManager: () => setIsManagerOpen(false),
    acceptAll: () => {
      setConsent(ACCEPT_ALL_CONSENT);
      setIsManagerOpen(false);
    },
    rejectNonEssential: () => {
      setConsent(REJECT_NON_ESSENTIAL_CONSENT);
      setIsManagerOpen(false);
    },
    savePreferences: (next) => {
      setConsent(next);
      setIsManagerOpen(false);
    },
  };

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent(): CookieConsentContextValue {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
}
