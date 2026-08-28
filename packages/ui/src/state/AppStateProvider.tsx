import type { ReactNode } from "react";
import { ReadArticlesProvider, ReadingListProvider, TagInterestsProvider, WishlistProvider } from "./collections";
import type { PersistedIdCollectionRemote } from "./createPersistedIdCollection";
import { CartProvider } from "./CartContext";
import { CookieConsentProvider } from "./CookieConsentContext";
import { LayoutPreferencesProvider } from "./LayoutPreferencesContext";
import { SoundUXProvider, type SoundUXBackendConfig } from "./SoundUXContext";
import { ThemeProvider } from "./ThemeContext";
import { ToastProvider } from "./ToastContext";
import { LanguageProvider } from "../locale/LanguageContext";
import { CurrencyProvider } from "../locale/CurrencyContext";
import { UiStringsProvider } from "../locale/UiStringsContext";

const STOREFRONT_SOUND_CONFIG: SoundUXBackendConfig = {
  enabled: false,
  volume: 0.7,
};

/**
 * Combines every mockup-only persisted store (theme, wishlist, reading list, cookie
 * consent) so the app only needs to mount a single provider near its root.
 *
 * `accountId`/`wishlistRemote`/`readingListRemote` are optional so this stays a
 * drop-in guest-only mockup provider by default; the storefront app supplies them
 * (via its own auth state and GraphQL adapters, see `lib/savedLists.ts`) to turn the
 * wishlist/reading list into authenticated, backend-synced collections without this
 * shared UI package depending on any app-specific auth or GraphQL client.
 */
export function AppStateProvider({
  children,
  accountId = null,
  wishlistRemote,
  readingListRemote,
}: {
  children: ReactNode;
  accountId?: string | number | null;
  wishlistRemote?: PersistedIdCollectionRemote;
  readingListRemote?: PersistedIdCollectionRemote;
}) {
  return (
    <LanguageProvider>
      <UiStringsProvider>
        <CurrencyProvider>
        <ThemeProvider>
          <SoundUXProvider backendConfig={STOREFRONT_SOUND_CONFIG}>
            <ToastProvider>
              <WishlistProvider accountId={accountId} remote={wishlistRemote}>
                <ReadingListProvider accountId={accountId} remote={readingListRemote}>
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
