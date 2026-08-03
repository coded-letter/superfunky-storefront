import type { ReactNode } from "react";
import { ReadArticlesProvider, ReadingListProvider, TagInterestsProvider, WishlistProvider } from "./collections";
import { CartProvider } from "./CartContext";
import { CookieConsentProvider } from "./CookieConsentContext";
import { LayoutPreferencesProvider } from "./LayoutPreferencesContext";
import { SoundUXProvider, type SoundUXBackendConfig } from "./SoundUXContext";
import { ThemeProvider } from "./ThemeContext";
import { ToastProvider } from "./ToastContext";
import { LanguageProvider } from "../locale/LanguageContext";
import { CurrencyProvider } from "../locale/CurrencyContext";
import { UiStringsProvider } from "../locale/UiStringsContext";

const MOCK_BACKEND_SOUND_CONFIG: SoundUXBackendConfig = {
  enabled: true,
  volume: 0.7,
  mappings: {
    link: { type: "sine", frequency: 720, duration: 0.08, gain: 0.028 },
    button: { type: "triangle", frequency: 560, duration: 0.06, gain: 0.032 },
    focus: { type: "square", frequency: 860, duration: 0.05, gain: 0.02 },
  },
};

/**
 * Combines every mockup-only persisted store (theme, wishlist, reading list, cookie
 * consent) so the app only needs to mount a single provider near its root.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <UiStringsProvider>
        <CurrencyProvider>
        <ThemeProvider>
          <SoundUXProvider backendConfig={MOCK_BACKEND_SOUND_CONFIG}>
            <ToastProvider>
              <WishlistProvider>
                <ReadingListProvider>
                  <ReadArticlesProvider>
                    <TagInterestsProvider>
                      <CartProvider>
                        <CookieConsentProvider>
                          <LayoutPreferencesProvider>{children}</LayoutPreferencesProvider>
                        </CookieConsentProvider>
                      </CartProvider>
                    </TagInterestsProvider>
                  </ReadArticlesProvider>
                </ReadingListProvider>
              </WishlistProvider>
            </ToastProvider>
          </SoundUXProvider>
        </ThemeProvider>
      </CurrencyProvider>
      </UiStringsProvider>
    </LanguageProvider>
  );
}
