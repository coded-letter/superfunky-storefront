import { useEffect, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { ProductCardData } from "../catalog/ProductCard";
import { useLayoutPreferences, useSoundUX } from "../state";
import { CartDrawer } from "./CartDrawer";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { FooterMockup, type FooterColumn } from "./FooterMockup";
import { HeaderMockup } from "./HeaderMockup";
import type { HeaderNavItem } from "./HeaderMockup";
import type { SearchAutocompleteProps } from "./SearchAutocomplete";
import { NewsletterSignupPopup } from "./NewsletterSignupPopup";
import { ToastContainer } from "./ToastContainer";

export type StorefrontChromeMockupProps = {
  children?: ReactNode;
  /** Suggested product shown in the cart drawer's empty state. */
  featuredProduct?: ProductCardData;
  primaryNavigation?: HeaderNavItem[];
  mobileNavigation?: HeaderNavItem[];
  footerColumns?: FooterColumn[];
  search?: SearchAutocompleteProps["search"];
  onNewsletterSubscribe?: (email: string) => Promise<void>;
  /** Language-aware home path (e.g. `"/en"`, `"/pl"`) for the logo link. Defaults to `"/"`. */
  homePath?: string;
  storefrontConfig?: {
    branding: {
      storeName: string;
      companyName: string;
      tagline: string;
      logoUrl: string | null;
      iconUrl: string | null;
      promoText: string;
    };
    headerIcons: {
      search: string;
      theme: string;
      account: string;
      readingList: string;
      wishlist: string;
      cart: string;
      menu: string;
    };
    features: {
      promo: boolean;
      search: boolean;
      languages: boolean;
      currencies: boolean;
      account: boolean;
      wishlist: boolean;
      readingList: boolean;
      cart: boolean;
      crypto: boolean;
    };
  };
};

export function StorefrontChromeMockup(props: StorefrontChromeMockupProps) {
  return <StorefrontChromeShell {...props} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const { playAction } = useSoundUX();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    playAction("navigation");
  }, [pathname, playAction]);

  return null;
}

function StorefrontChromeShell({ children, featuredProduct, primaryNavigation, mobileNavigation, footerColumns, search, onNewsletterSubscribe, homePath, storefrontConfig }: StorefrontChromeMockupProps) {
  const {
    showAnnouncementBar,
    announcementBarScrollEffect,
    headerSticky,
    headerSearchVariant,
    headerLogoVariant,
    showHeaderLogo,
    showHeaderSearchIcon,
    showHeaderLanguageSwitcher,
    showHeaderCurrencySwitcher,
    showHeaderDarkModeToggle,
    showHeaderAccountLink,
    showHeaderReadingListLink,
    showHeaderWishlistLink,
    showHeaderCartIcon,
    cartTriggerVariant,
    showCartDrawerPromotedProduct,
    showFooter,
    footerColumnsLayout,
    footerNewsletterLayout,
    showFooterNewsletter,
    footerAssistantLayout,
    footerLogoVariant,
    footerBottomBarLayout,
    footerExtraWrapperLayout,
    showFooterLogo,
    showFooterExtraWrapper,
    showFooterSpotifyPlayer,
    showFooterAssistantFrame,
    showFooterPaymentMethods,
    showFooterSocialLinks,
    showFooterCopyright,
    hiddenFooterPaymentMethodKeys,
    hiddenFooterSocialLinkKeys,
    themeMaxWidthPx,
    themeRadiusPx,
  } = useLayoutPreferences();

  useEffect(() => {
    const iconUrl = storefrontConfig?.branding.iconUrl;
    if (!iconUrl) return;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousHref = icon?.href;
    const createdIcon = !icon;
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = iconUrl;
    return () => {
      if (createdIcon) {
        icon.remove();
      } else if (previousHref) {
        icon.href = previousHref;
      }
    };
  }, [storefrontConfig?.branding.iconUrl]);

  // Dark mode is applied at the document root (see ThemeContext), so no local
  // wrapper class is needed here — this keeps every descendant (including anything
  // rendered outside this tree, e.g. portals) and the native scrollbar in sync.
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgb(var(--brand-500)/0.06),_transparent_45%)] bg-[rgb(var(--theme-background))] text-[rgb(var(--theme-foreground))] dark:bg-[radial-gradient(circle_at_top,_rgb(var(--brand-500)/0.12),_transparent_45%)] dark:bg-[rgb(var(--theme-foreground))] dark:text-[rgb(var(--theme-background))]">
      <ScrollToTop />
      <HeaderMockup
        primaryNavigation={primaryNavigation}
        mobileNavigation={mobileNavigation}
        homePath={homePath}
        announcementText={storefrontConfig?.branding.promoText}
        projectName={storefrontConfig?.branding.storeName}
        projectTagline={storefrontConfig?.branding.tagline}
        logoUrl={storefrontConfig?.branding.logoUrl || undefined}
        iconUrl={storefrontConfig?.branding.iconUrl || undefined}
        headerIcons={storefrontConfig?.headerIcons}
        showAnnouncementBar={showAnnouncementBar && storefrontConfig?.features.promo !== false}
        announcementScrollEffect={announcementBarScrollEffect}
        sticky={headerSticky}
        searchVariant={headerSearchVariant}
        logoVariant={headerLogoVariant}
        showLogo={showHeaderLogo}
        showSearch={showHeaderSearchIcon && storefrontConfig?.features.search !== false}
        showLanguageSwitcher={showHeaderLanguageSwitcher && storefrontConfig?.features.languages !== false}
        showCurrencySwitcher={showHeaderCurrencySwitcher && storefrontConfig?.features.currencies !== false}
        showDarkModeToggle={showHeaderDarkModeToggle}
        showAccountLink={showHeaderAccountLink && storefrontConfig?.features.account !== false}
        showReadingListLink={showHeaderReadingListLink && storefrontConfig?.features.readingList !== false}
        showWishlistLink={showHeaderWishlistLink && storefrontConfig?.features.wishlist !== false}
        showCartIcon={showHeaderCartIcon && storefrontConfig?.features.cart !== false}
        cartTriggerVariant={cartTriggerVariant}
        search={search}
      />

      <main
        className="funky-main mx-auto w-full flex-1 rounded-[var(--theme-radius)] px-4 pb-16 sm:px-6 lg:px-8"
        style={{ maxWidth: `${themeMaxWidthPx}px`, borderRadius: `${themeRadiusPx}px` }}
      >
        {/* Renders routed pages via <Outlet /> when used as a router layout route, or explicit children otherwise. */}
        {children ?? <Outlet />}
      </main>

      {showFooter ? (
        <FooterMockup
          footerColumns={footerColumns}
          columnsLayout={footerColumnsLayout}
          newsletterLayout={footerNewsletterLayout}
          showNewsletter={showFooterNewsletter}
          assistantSpotifyLayout={footerAssistantLayout}
          logoVariant={footerLogoVariant}
          showLogo={showFooterLogo}
          bottomBarLayout={footerBottomBarLayout}
          extraWrapperLayout={footerExtraWrapperLayout}
          showExtraWrapper={showFooterExtraWrapper}
          showSpotifyPlayer={showFooterSpotifyPlayer}
          showAssistantFrame={showFooterAssistantFrame}
          showPaymentMethods={showFooterPaymentMethods}
          showSocialLinks={showFooterSocialLinks}
          showCopyright={showFooterCopyright}
          hiddenPaymentMethodKeys={[
            ...hiddenFooterPaymentMethodKeys,
            ...(storefrontConfig?.features.crypto === false ? ["btc", "eth"] : []),
          ]}
          hiddenSocialLinkKeys={hiddenFooterSocialLinkKeys}
          projectName={storefrontConfig?.branding.storeName}
          logoUrl={storefrontConfig?.branding.logoUrl || undefined}
          iconUrl={storefrontConfig?.branding.iconUrl || undefined}
          copyrightText={storefrontConfig ? `© ${new Date().getFullYear()} ${storefrontConfig.branding.companyName}. All rights reserved.` : undefined}
        />
      ) : null}

      <CookieConsentBanner />
      <NewsletterSignupPopup onSubscribe={onNewsletterSubscribe} />
      {cartTriggerVariant === "drawer" && storefrontConfig?.features.cart !== false ? (
        <CartDrawer featuredProduct={featuredProduct} showPromotedProduct={showCartDrawerPromotedProduct} />
      ) : null}
      <ToastContainer />
    </div>
  );
}
