import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ArrowUp, ChevronUp } from "lucide-react";
import type { ProductCardData } from "../catalog/ProductCard";
import { isSupportedSocialPlatform, socialIconSrc, useT, type SocialLink } from "../locale";
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
  /** Suggested products shown in either cart presentation's empty state. */
  featuredProducts?: ProductCardData[];
  primaryNavigation?: HeaderNavItem[];
  mobileNavigation?: HeaderNavItem[];
  footerColumns?: FooterColumn[];
  hideNavigation?: boolean;
  search?: SearchAutocompleteProps["search"];
  onNewsletterSubscribe?: (email: string, source?: "newsletter-popup" | "newsletter-footer") => Promise<void>;
  onPushToggle?: () => void;
  pushSubscribed?: boolean;
  pushBusy?: boolean;
  /** Language-aware home path (e.g. `"/en"`, `"/pl"`) for the logo link. Defaults to `"/"`. */
  homePath?: string;
  storefrontConfig?: {
    branding: {
      storeName: string;
      companyName: string;
      tagline: string;
      logoUrl: string | null;
      iconUrl: string | null;
      promoHtml: string;
    };
    headerIcons: {
      search: string;
      theme: string;
      account: string;
      push: string;
      readingList: string;
      wishlist: string;
      cart: string;
      menu: string;
      assistant: string;
    };
    headerIconMedia?: Partial<Record<"search" | "theme" | "account" | "readingList" | "wishlist" | "cart" | "menu" | "assistant", string | null>>;
    aiAssistant?: {
      enabled?: boolean;
      provider?: string;
      placement?: "footer" | "header" | "fixed";
      nativeProviderActive?: boolean;
      iframeUrl?: string | null;
      iframeTitle: string;
      iframeSandbox: string;
      iframeReferrerPolicy: string;
    };
    footer?: {
      socialLinks: Array<{
        id: string;
        platform: string;
        url: string;
        label: string;
      }>;
      newsletterHeading?: string;
      newsletterText?: string;
      newsletterPrivacyLabel?: string;
      extraHtml?: string;
      copyrightText?: string;
      themeCredit?: string;
      showThemeCredit?: boolean;
      spotifyPlaylistUrl?: string;
      spotifyPlaylistEmbedUrl?: string;
      spotifyPlayerTitle?: string;
      spotifyPlayerDescription?: string;
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
      quickView: boolean;
      push: boolean;
      crypto: boolean;
    };
  };
  headerActionSlot?: ReactNode;
  footerAssistantSlot?: ReactNode;
  assistantOverlaySlot?: ReactNode;
  floatingAssistantSlot?: ReactNode;
};

export function StorefrontChromeMockup(props: StorefrontChromeMockupProps) {
  return <StorefrontChromeShell {...props} />;
}

function RouteScrollReset() {
  const { pathname } = useLocation();
  const { playAction } = useSoundUX();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    playAction("navigation");
  }, [pathname, playAction]);

  return null;
}

function BackToTopButton() {
  const t = useT();
  const {
    showBackToTop,
    backToTopStyle,
    backToTopIcon,
    backToTopPlacement,
  } = useLayoutPreferences();
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && window.scrollY >= 480);

  useEffect(() => {
    if (!showBackToTop) return undefined;
    const updateVisibility = () => setVisible(window.scrollY >= 480);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [showBackToTop]);

  if (!showBackToTop || !visible) return null;

  const placementClass = backToTopPlacement === "bottom-left"
    ? "left-5"
    : backToTopPlacement === "bottom-center"
      ? "left-1/2 -translate-x-1/2"
      : "right-5";
  const styleClass = backToTopStyle === "outline"
    ? "border border-brand-500 bg-white text-brand-700 dark:bg-zinc-950 dark:text-brand-300"
    : backToTopStyle === "ghost"
      ? "bg-zinc-950/70 text-white backdrop-blur"
      : "bg-brand-600 text-white shadow-glow hover:bg-brand-700";
  const label = t("navigation.back_to_top");

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => window.scrollTo({
        top: 0,
        left: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })}
      className={`fixed bottom-5 z-40 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:-translate-y-0.5 ${placementClass} ${styleClass}`}
    >
      {backToTopIcon === "text" ? (
        <span>{label}</span>
      ) : backToTopIcon === "chevron" ? (
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      ) : (
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

function StorefrontChromeShell({
  children,
  featuredProducts = [],
  primaryNavigation,
  mobileNavigation,
  footerColumns,
  hideNavigation,
  search,
  onNewsletterSubscribe,
  onPushToggle,
  pushSubscribed,
  pushBusy,
  homePath,
  storefrontConfig,
  headerActionSlot,
  footerAssistantSlot,
  assistantOverlaySlot,
  floatingAssistantSlot,
}: StorefrontChromeMockupProps) {
  const {
    showAnnouncementBar,
    announcementBarScrollEffect,
    headerSticky,
    headerSearchVariant,
    headerLogoVariant,
    headerArrangement,
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
    showAllCartPromotedProducts,
    showFooter,
    footerColumnsLayout,
    footerNewsletterLayout,
    showFooterNewsletter,
    footerAssistantLayout,
    footerFeatureLayout,
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
  const footerSocialLinks: SocialLink[] = (storefrontConfig?.footer?.socialLinks ?? []).flatMap((profile) =>
    isSupportedSocialPlatform(profile.platform)
      ? [{
          id: profile.id,
          platform: profile.platform,
          label: profile.label,
          href: profile.url,
          icon: socialIconSrc(profile.platform),
        }]
      : [],
  );
  const cartFeaturedProducts = showAllCartPromotedProducts
    ? featuredProducts
    : featuredProducts.slice(0, 1);
  const spotifyPlaylistUrl = storefrontConfig?.footer?.spotifyPlaylistUrl?.trim() ?? "";

  useEffect(() => {
    const iconUrl = storefrontConfig?.branding.iconUrl;
    if (!iconUrl) return;
    let icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'));
    const createdIcon = icons.length === 0;
    if (createdIcon) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
      icons = [icon];
    }
    const previous = icons.map((icon) => ({
      icon,
      href: icon.getAttribute("href"),
      type: icon.getAttribute("type"),
      sizes: icon.getAttribute("sizes"),
    }));
    for (const icon of icons) {
      icon.href = iconUrl;
      icon.removeAttribute("type");
      icon.removeAttribute("sizes");
    }
    return () => {
      if (createdIcon) {
        icons[0]?.remove();
        return;
      }
      for (const { icon, href, type, sizes } of previous) {
        if (href === null) icon.removeAttribute("href"); else icon.setAttribute("href", href);
        if (type === null) icon.removeAttribute("type"); else icon.setAttribute("type", type);
        if (sizes === null) icon.removeAttribute("sizes"); else icon.setAttribute("sizes", sizes);
      }
    };
  }, [storefrontConfig?.branding.iconUrl]);

  // Dark mode is applied at the document root (see ThemeContext), so no local
  // wrapper class is needed here — this keeps every descendant (including anything
  // rendered outside this tree, e.g. portals) and the native scrollbar in sync.
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgb(var(--brand-500)/0.06),_transparent_45%)] bg-[rgb(var(--theme-background))] text-[rgb(var(--theme-foreground))] dark:bg-[radial-gradient(circle_at_top,_rgb(var(--brand-500)/0.12),_transparent_45%)] dark:bg-[rgb(var(--theme-foreground))] dark:text-[rgb(var(--theme-background))]">
      <RouteScrollReset />
      <HeaderMockup
        primaryNavigation={primaryNavigation}
        mobileNavigation={mobileNavigation}
        hideNavigation={hideNavigation}
        homePath={homePath}
        announcementHtml={storefrontConfig?.branding.promoHtml ?? ""}
        projectName={storefrontConfig?.branding.storeName}
        projectTagline={storefrontConfig?.branding.tagline}
        logoUrl={storefrontConfig?.branding.logoUrl || undefined}
        iconUrl={storefrontConfig?.branding.iconUrl || undefined}
        headerIcons={storefrontConfig?.headerIcons}
        headerIconMedia={storefrontConfig?.headerIconMedia}
        showAnnouncementBar={showAnnouncementBar && storefrontConfig?.features.promo !== false}
        announcementScrollEffect={announcementBarScrollEffect}
        sticky={headerSticky}
        searchVariant={headerSearchVariant}
        logoVariant={headerLogoVariant}
        arrangement={headerArrangement}
        showLogo={showHeaderLogo}
        showSearch={showHeaderSearchIcon && storefrontConfig?.features.search !== false}
        showLanguageSwitcher={showHeaderLanguageSwitcher && storefrontConfig?.features.languages !== false}
        showCurrencySwitcher={showHeaderCurrencySwitcher && storefrontConfig?.features.currencies !== false}
        showDarkModeToggle={showHeaderDarkModeToggle}
        showAccountLink={showHeaderAccountLink && storefrontConfig?.features.account !== false}
        showPushAction={storefrontConfig?.features.push !== false}
        onPushToggle={onPushToggle}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        showReadingListLink={showHeaderReadingListLink && storefrontConfig?.features.readingList !== false}
        showWishlistLink={showHeaderWishlistLink && storefrontConfig?.features.wishlist !== false}
        showCartIcon={showHeaderCartIcon && storefrontConfig?.features.cart !== false}
        cartTriggerVariant={cartTriggerVariant}
        cartFeaturedProducts={cartFeaturedProducts}
        showCartPromotedProduct={showCartDrawerPromotedProduct}
        search={search}
        actionSlot={headerActionSlot}
      />

      <main
        id="sf-main"
        className="sf-main funky-main mx-auto w-full flex-1 rounded-[var(--theme-radius)] px-4 pb-16 sm:px-6 lg:px-8"
        style={{
          maxWidth: `${themeMaxWidthPx}px`,
          borderRadius: `${themeRadiusPx}px`,
          "--funky-content-max-width": `${themeMaxWidthPx}px`,
        } as CSSProperties}
      >
        {/* Renders routed pages via <Outlet /> when used as a router layout route, or explicit children otherwise. */}
        {children ?? <Outlet />}
      </main>

      {showFooter ? (
        <FooterMockup
          footerColumns={footerColumns}
          columnsLayout={footerColumnsLayout}
          newsletterLayout={footerNewsletterLayout}
          newsletterTitle={storefrontConfig?.footer?.newsletterHeading || undefined}
          newsletterDescription={storefrontConfig?.footer?.newsletterText || undefined}
          privacyConsentLabel={storefrontConfig?.footer?.newsletterPrivacyLabel || undefined}
          showNewsletter={showFooterNewsletter}
          assistantSpotifyLayout={footerAssistantLayout}
          featureLayout={footerFeatureLayout}
          logoVariant={footerLogoVariant}
          showLogo={showFooterLogo}
          bottomBarLayout={footerBottomBarLayout}
          extraWrapperLayout={footerExtraWrapperLayout}
          showExtraWrapper={showFooterExtraWrapper}
          extraWrapperHtml={storefrontConfig?.footer?.extraHtml ?? ""}
          showSpotifyPlayer={showFooterSpotifyPlayer && Boolean(spotifyPlaylistUrl)}
          spotifyPlayerTitle={storefrontConfig?.footer?.spotifyPlayerTitle || undefined}
          spotifyPlayerDescription={storefrontConfig?.footer?.spotifyPlayerDescription || undefined}
          spotifyPlayerProps={spotifyPlaylistUrl ? { uri: spotifyPlaylistUrl } : undefined}
          showAssistantFrame={showFooterAssistantFrame && Boolean(footerAssistantSlot)}
          showPaymentMethods={showFooterPaymentMethods}
          showSocialLinks={showFooterSocialLinks}
          socialLinks={footerSocialLinks}
          showCopyright={showFooterCopyright}
          hiddenPaymentMethodKeys={hiddenFooterPaymentMethodKeys}
          hiddenSocialLinkKeys={hiddenFooterSocialLinkKeys}
          projectName={storefrontConfig?.branding.storeName}
          logoUrl={storefrontConfig?.branding.logoUrl || undefined}
          iconUrl={storefrontConfig?.branding.iconUrl || undefined}
          copyrightText={storefrontConfig?.footer?.copyrightText ?? ""}
          themeCredit={storefrontConfig?.footer?.themeCredit ?? ""}
          showThemeCredit={storefrontConfig?.footer?.showThemeCredit === true}
          onNewsletterSubscribe={onNewsletterSubscribe}
          assistantSlot={footerAssistantSlot}
        />
      ) : null}

      <CookieConsentBanner providerName={storefrontConfig?.branding.storeName || "Superfunky"} />
      <NewsletterSignupPopup
        title={storefrontConfig?.footer?.newsletterHeading || undefined}
        description={storefrontConfig?.footer?.newsletterText || undefined}
        privacyConsentLabel={storefrontConfig?.footer?.newsletterPrivacyLabel || undefined}
        onSubscribe={(email) => onNewsletterSubscribe?.(email, "newsletter-popup") ?? Promise.resolve()}
      />
      {cartTriggerVariant === "drawer" && storefrontConfig?.features.cart !== false ? (
        <CartDrawer
          featuredProducts={cartFeaturedProducts}
          showPromotedProduct={showCartDrawerPromotedProduct}
        />
      ) : null}
      {assistantOverlaySlot}
      <ToastContainer />
      <BackToTopButton />
      {floatingAssistantSlot}
    </div>
  );
}
