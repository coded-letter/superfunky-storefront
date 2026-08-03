import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  FooterAssistantLayout,
  FooterBottomBarLayout,
  FooterColumnsLayout,
  FooterExtraWrapperLayout,
  FooterLogoVariant,
  FooterNewsletterLayout,
} from "../layout/FooterMockup";
import type { CartTriggerVariant, HeaderLogoVariant, HeaderSearchVariant } from "../layout/HeaderMockup";
import type { NewsletterPopupVariant } from "../layout/NewsletterSignupPopup";
import { applyBrandPalette, type BrandGradientStyle, type BrandPaletteId } from "./brandPalettes";

/**
 * Site-wide chrome layout preferences (header search style, header icon visibility,
 * footer column/newsletter/assistant layouts) — driven by the `/layout-studio` page's
 * switches so a merchant can try each alternative against the real, live header/footer
 * instead of an isolated preview. Intentionally session-only (not persisted to
 * localStorage, unlike wishlist/reading-list/theme) since this is a design-review tool,
 * not a customer-facing setting.
 */
export type LayoutPreferencesState = {
  showAnnouncementBar: boolean;
  /** Whether the top promo bar collapses on scroll (current default) or stays put
   * regardless of scroll position once `showAnnouncementBar` is on. */
  announcementBarScrollEffect: boolean;
  /** `true` (default, current) pins the header to the top of the viewport at all
   * times. `false` lets it scroll away with the page like any other content. */
  headerSticky: boolean;
  headerSearchVariant: HeaderSearchVariant;
  headerLogoVariant: HeaderLogoVariant;
  showHeaderLogo: boolean;
  showHeaderSearchIcon: boolean;
  showHeaderLanguageSwitcher: boolean;
  showHeaderCurrencySwitcher: boolean;
  showHeaderDarkModeToggle: boolean;
  showHeaderAccountLink: boolean;
  showHeaderReadingListLink: boolean;
  showHeaderWishlistLink: boolean;
  showHeaderCartIcon: boolean;
  /** `"drawer"` (default, current) opens the full slide-in side panel. `"dropdown"`
   * opens a compact popover anchored under the header's cart icon instead. */
  cartTriggerVariant: CartTriggerVariant;
  /** Whole cart-drawer "you might like" promoted-product suggestion, shown while the
   * drawer is empty, on/off. `true` (default). */
  showCartDrawerPromotedProduct: boolean;
  /** Whole footer on/off. `true` (default). */
  showFooter: boolean;
  footerColumnsLayout: FooterColumnsLayout;
  footerNewsletterLayout: FooterNewsletterLayout;
  /** Whole pre-footer newsletter section on/off — independent of `footerNewsletterLayout`.
   * `true` (default). */
  showFooterNewsletter: boolean;
  footerAssistantLayout: FooterAssistantLayout;
  footerLogoVariant: FooterLogoVariant;
  footerBottomBarLayout: FooterBottomBarLayout;
  footerExtraWrapperLayout: FooterExtraWrapperLayout;
  showFooterLogo: boolean;
  showFooterExtraWrapper: boolean;
  showFooterSpotifyPlayer: boolean;
  showFooterAssistantFrame: boolean;
  showFooterPaymentMethods: boolean;
  showFooterSocialLinks: boolean;
  showFooterCopyright: boolean;
  /** Payment-method `key`s (visa/mastercard/paypal/apay/gpay/stripe/blik/btc/eth) hidden
   * one by one, independent of the whole-row `showFooterPaymentMethods` toggle. */
  hiddenFooterPaymentMethodKeys: string[];
  /** Social-link `key`s hidden one by one, independent of the whole-row
   * `showFooterSocialLinks` toggle. */
  hiddenFooterSocialLinkKeys: string[];
  /** The theme's global content column max-width, in pixels. Drives `<main>`'s width
   * in `StorefrontChromeMockup` and the constrained inner column of full-bleed hero
   * layouts. Default `1280` matches the original fixed `max-w-7xl` Tailwind class. */
  themeMaxWidthPx: number;
  /** Base radius used by every standard Tailwind rounded token. The default 16px
   * preserves the existing 4/6/8/12/16/24px scale through proportional multipliers. */
  themeRadiusPx: number;
  /** Whole visible breadcrumb trail on/off. Structured breadcrumb data remains available
   * to pages that request it even when the storefront navigation trail is hidden. */
  showBreadcrumbs: boolean;
  /** Whole newsletter-signup popup module on/off. `true` (default). */
  showNewsletterPopup: boolean;
  /** Which visual treatment the popup renders — `"split"` (current default, image +
   * form side by side), or two newer "fresh" alternatives: `"modern-card"` (a compact
   * bottom-corner toast-style card) and `"modern-center"` (a centered, image-less
   * gradient card). */
  newsletterPopupVariant: NewsletterPopupVariant;
  /** How many days pass before a visitor who dismissed the popup ("Maybe later" or the
   * close button) is shown it again. Default `7`, matching the original fixed cooldown. */
  newsletterPopupCooldownDays: number;
  /** Which brand-color preset drives the theme's `brand` Tailwind scale and
   * `brand-gradient`/`shadow-glow` tokens site-wide — see `brandPalettes.ts`.
   * `"violet"` (default) matches the theme's original identity. */
  brandPalette: BrandPaletteId;
  /** Whether the `brand-gradient`/`brand-gradient-soft` tokens render as an actual
   * two-tone gradient (`"gradient"`, default) or collapse to a single flat brand color
   * (`"flat"`) — a quick way to preview a calmer, single-tone visual identity. */
  brandGradientStyle: BrandGradientStyle;
  checkoutStoreMode: "physical" | "digital";
  checkoutCouponPosition: "inline" | "top";
  checkoutPaymentPosition: "left" | "right";
  checkoutSummaryPosition: "sticky" | "static";
  checkoutHideOptionalBillingFields: boolean;
  checkoutHideOptionalShippingFields: boolean;
  checkoutShowOrderNotes: boolean;
  checkoutShowTerms: boolean;
  checkoutShowPrivacy: boolean;
};

const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferencesState = {
  showAnnouncementBar: true,
  announcementBarScrollEffect: true,
  headerSticky: true,
  headerSearchVariant: "full-width",
  headerLogoVariant: "text-image",
  showHeaderLogo: true,
  showHeaderSearchIcon: true,
  showHeaderLanguageSwitcher: true,
  showHeaderCurrencySwitcher: true,
  showHeaderDarkModeToggle: true,
  showHeaderAccountLink: true,
  showHeaderReadingListLink: true,
  showHeaderWishlistLink: true,
  showHeaderCartIcon: true,
  cartTriggerVariant: "drawer",
  showCartDrawerPromotedProduct: true,
  showFooter: true,
  footerColumnsLayout: "grid-4",
  footerNewsletterLayout: "banner",
  showFooterNewsletter: true,
  footerAssistantLayout: "side-by-side",
  footerLogoVariant: "text-image",
  footerBottomBarLayout: "split",
  footerExtraWrapperLayout: "inline",
  showFooterLogo: true,
  showFooterExtraWrapper: true,
  showFooterSpotifyPlayer: true,
  showFooterAssistantFrame: true,
  showFooterPaymentMethods: true,
  showFooterSocialLinks: true,
  showFooterCopyright: true,
  hiddenFooterPaymentMethodKeys: [],
  hiddenFooterSocialLinkKeys: [],
  themeMaxWidthPx: 1280,
  themeRadiusPx: 16,
  showBreadcrumbs: true,
  showNewsletterPopup: true,
  newsletterPopupVariant: "split",
  newsletterPopupCooldownDays: 7,
  brandPalette: "violet",
  brandGradientStyle: "gradient",
  checkoutStoreMode: "physical",
  checkoutCouponPosition: "inline",
  checkoutPaymentPosition: "left",
  checkoutSummaryPosition: "sticky",
  checkoutHideOptionalBillingFields: false,
  checkoutHideOptionalShippingFields: false,
  checkoutShowOrderNotes: true,
  checkoutShowTerms: true,
  checkoutShowPrivacy: true,
};

type LayoutPreferencesContextValue = LayoutPreferencesState & {
  setShowAnnouncementBar: (value: boolean) => void;
  setAnnouncementBarScrollEffect: (value: boolean) => void;
  setHeaderSticky: (value: boolean) => void;
  setHeaderSearchVariant: (value: HeaderSearchVariant) => void;
  setHeaderLogoVariant: (value: HeaderLogoVariant) => void;
  setShowHeaderLogo: (value: boolean) => void;
  setShowHeaderSearchIcon: (value: boolean) => void;
  setShowHeaderLanguageSwitcher: (value: boolean) => void;
  setShowHeaderCurrencySwitcher: (value: boolean) => void;
  setShowHeaderDarkModeToggle: (value: boolean) => void;
  setShowHeaderAccountLink: (value: boolean) => void;
  setShowHeaderReadingListLink: (value: boolean) => void;
  setShowHeaderWishlistLink: (value: boolean) => void;
  setShowHeaderCartIcon: (value: boolean) => void;
  setCartTriggerVariant: (value: CartTriggerVariant) => void;
  setShowCartDrawerPromotedProduct: (value: boolean) => void;
  setShowFooter: (value: boolean) => void;
  setFooterColumnsLayout: (value: FooterColumnsLayout) => void;
  setFooterNewsletterLayout: (value: FooterNewsletterLayout) => void;
  setShowFooterNewsletter: (value: boolean) => void;
  setFooterAssistantLayout: (value: FooterAssistantLayout) => void;
  setFooterLogoVariant: (value: FooterLogoVariant) => void;
  setFooterBottomBarLayout: (value: FooterBottomBarLayout) => void;
  setFooterExtraWrapperLayout: (value: FooterExtraWrapperLayout) => void;
  setShowFooterLogo: (value: boolean) => void;
  setShowFooterExtraWrapper: (value: boolean) => void;
  setShowFooterSpotifyPlayer: (value: boolean) => void;
  setShowFooterAssistantFrame: (value: boolean) => void;
  setShowFooterPaymentMethods: (value: boolean) => void;
  setShowFooterSocialLinks: (value: boolean) => void;
  setShowFooterCopyright: (value: boolean) => void;
  /** Toggles a single payment-method key in/out of `hiddenFooterPaymentMethodKeys`. */
  toggleFooterPaymentMethodKey: (key: string) => void;
  /** Toggles a single social-link key in/out of `hiddenFooterSocialLinkKeys`. */
  toggleFooterSocialLinkKey: (key: string) => void;
  setThemeMaxWidthPx: (value: number) => void;
  setThemeRadiusPx: (value: number) => void;
  setShowBreadcrumbs: (value: boolean) => void;
  setShowNewsletterPopup: (value: boolean) => void;
  setNewsletterPopupVariant: (value: NewsletterPopupVariant) => void;
  setNewsletterPopupCooldownDays: (value: number) => void;
  setBrandPalette: (value: BrandPaletteId) => void;
  setBrandGradientStyle: (value: BrandGradientStyle) => void;
  setCheckoutStoreMode: (value: "physical" | "digital") => void;
  setCheckoutCouponPosition: (value: "inline" | "top") => void;
  setCheckoutPaymentPosition: (value: "left" | "right") => void;
  setCheckoutSummaryPosition: (value: "sticky" | "static") => void;
  setCheckoutHideOptionalBillingFields: (value: boolean) => void;
  setCheckoutHideOptionalShippingFields: (value: boolean) => void;
  setCheckoutShowOrderNotes: (value: boolean) => void;
  setCheckoutShowTerms: (value: boolean) => void;
  setCheckoutShowPrivacy: (value: boolean) => void;
};

const LayoutPreferencesContext = createContext<LayoutPreferencesContextValue | null>(null);

export function LayoutPreferencesProvider({ children }: { children: ReactNode }) {
  const [showAnnouncementBar, setShowAnnouncementBar] = useState(DEFAULT_LAYOUT_PREFERENCES.showAnnouncementBar);
  const [announcementBarScrollEffect, setAnnouncementBarScrollEffect] = useState(
    DEFAULT_LAYOUT_PREFERENCES.announcementBarScrollEffect,
  );
  const [headerSticky, setHeaderSticky] = useState(DEFAULT_LAYOUT_PREFERENCES.headerSticky);
  const [headerSearchVariant, setHeaderSearchVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.headerSearchVariant);
  const [headerLogoVariant, setHeaderLogoVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.headerLogoVariant);
  const [showHeaderLogo, setShowHeaderLogo] = useState(DEFAULT_LAYOUT_PREFERENCES.showHeaderLogo);
  const [showHeaderSearchIcon, setShowHeaderSearchIcon] = useState(DEFAULT_LAYOUT_PREFERENCES.showHeaderSearchIcon);
  const [showHeaderLanguageSwitcher, setShowHeaderLanguageSwitcher] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showHeaderLanguageSwitcher,
  );
  const [showHeaderCurrencySwitcher, setShowHeaderCurrencySwitcher] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showHeaderCurrencySwitcher,
  );
  const [showHeaderDarkModeToggle, setShowHeaderDarkModeToggle] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showHeaderDarkModeToggle,
  );
  const [showHeaderAccountLink, setShowHeaderAccountLink] = useState(DEFAULT_LAYOUT_PREFERENCES.showHeaderAccountLink);
  const [showHeaderReadingListLink, setShowHeaderReadingListLink] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showHeaderReadingListLink,
  );
  const [showHeaderWishlistLink, setShowHeaderWishlistLink] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showHeaderWishlistLink,
  );
  const [showHeaderCartIcon, setShowHeaderCartIcon] = useState(DEFAULT_LAYOUT_PREFERENCES.showHeaderCartIcon);
  const [cartTriggerVariant, setCartTriggerVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.cartTriggerVariant);
  const [showCartDrawerPromotedProduct, setShowCartDrawerPromotedProduct] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showCartDrawerPromotedProduct,
  );
  const [showFooter, setShowFooter] = useState(DEFAULT_LAYOUT_PREFERENCES.showFooter);
  const [footerColumnsLayout, setFooterColumnsLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.footerColumnsLayout);
  const [footerNewsletterLayout, setFooterNewsletterLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.footerNewsletterLayout);
  const [showFooterNewsletter, setShowFooterNewsletter] = useState(DEFAULT_LAYOUT_PREFERENCES.showFooterNewsletter);
  const [footerAssistantLayout, setFooterAssistantLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.footerAssistantLayout);
  const [footerLogoVariant, setFooterLogoVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.footerLogoVariant);
  const [footerBottomBarLayout, setFooterBottomBarLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.footerBottomBarLayout);
  const [footerExtraWrapperLayout, setFooterExtraWrapperLayout] = useState(
    DEFAULT_LAYOUT_PREFERENCES.footerExtraWrapperLayout,
  );
  const [showFooterLogo, setShowFooterLogo] = useState(DEFAULT_LAYOUT_PREFERENCES.showFooterLogo);
  const [showFooterExtraWrapper, setShowFooterExtraWrapper] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showFooterExtraWrapper,
  );
  const [showFooterSpotifyPlayer, setShowFooterSpotifyPlayer] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showFooterSpotifyPlayer,
  );
  const [showFooterAssistantFrame, setShowFooterAssistantFrame] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showFooterAssistantFrame,
  );
  const [showFooterPaymentMethods, setShowFooterPaymentMethods] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showFooterPaymentMethods,
  );
  const [showFooterSocialLinks, setShowFooterSocialLinks] = useState(DEFAULT_LAYOUT_PREFERENCES.showFooterSocialLinks);
  const [showFooterCopyright, setShowFooterCopyright] = useState(DEFAULT_LAYOUT_PREFERENCES.showFooterCopyright);
  const [hiddenFooterPaymentMethodKeys, setHiddenFooterPaymentMethodKeys] = useState(
    DEFAULT_LAYOUT_PREFERENCES.hiddenFooterPaymentMethodKeys,
  );
  const [hiddenFooterSocialLinkKeys, setHiddenFooterSocialLinkKeys] = useState(
    DEFAULT_LAYOUT_PREFERENCES.hiddenFooterSocialLinkKeys,
  );
  const [themeMaxWidthPx, setThemeMaxWidthPx] = useState(DEFAULT_LAYOUT_PREFERENCES.themeMaxWidthPx);
  const [themeRadiusPx, setThemeRadiusPx] = useState(DEFAULT_LAYOUT_PREFERENCES.themeRadiusPx);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(DEFAULT_LAYOUT_PREFERENCES.showBreadcrumbs);
  const [showNewsletterPopup, setShowNewsletterPopup] = useState(DEFAULT_LAYOUT_PREFERENCES.showNewsletterPopup);
  const [newsletterPopupVariant, setNewsletterPopupVariant] = useState(
    DEFAULT_LAYOUT_PREFERENCES.newsletterPopupVariant,
  );
  const [newsletterPopupCooldownDays, setNewsletterPopupCooldownDays] = useState(
    DEFAULT_LAYOUT_PREFERENCES.newsletterPopupCooldownDays,
  );
  const [brandPalette, setBrandPalette] = useState(DEFAULT_LAYOUT_PREFERENCES.brandPalette);
  const [brandGradientStyle, setBrandGradientStyle] = useState(DEFAULT_LAYOUT_PREFERENCES.brandGradientStyle);
  const [checkoutStoreMode, setCheckoutStoreMode] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutStoreMode);
  const [checkoutCouponPosition, setCheckoutCouponPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutCouponPosition);
  const [checkoutPaymentPosition, setCheckoutPaymentPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutPaymentPosition);
  const [checkoutSummaryPosition, setCheckoutSummaryPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutSummaryPosition);
  const [checkoutHideOptionalBillingFields, setCheckoutHideOptionalBillingFields] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutHideOptionalBillingFields);
  const [checkoutHideOptionalShippingFields, setCheckoutHideOptionalShippingFields] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutHideOptionalShippingFields);
  const [checkoutShowOrderNotes, setCheckoutShowOrderNotes] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowOrderNotes);
  const [checkoutShowTerms, setCheckoutShowTerms] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowTerms);
  const [checkoutShowPrivacy, setCheckoutShowPrivacy] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowPrivacy);
  const [hasLayoutStudioBrandOverride, setHasLayoutStudioBrandOverride] = useState(false);
  const chooseBrandPalette = useCallback((value: BrandPaletteId) => {
    setBrandPalette(value);
    setHasLayoutStudioBrandOverride(true);
  }, []);
  const chooseBrandGradientStyle = useCallback((value: BrandGradientStyle) => {
    setBrandGradientStyle(value);
    setHasLayoutStudioBrandOverride(true);
  }, []);

  useEffect(() => {
    if (!hasLayoutStudioBrandOverride) return;
    applyBrandPalette(brandPalette, brandGradientStyle);
  }, [brandGradientStyle, brandPalette, hasLayoutStudioBrandOverride]);

  useEffect(() => {
    document.documentElement.style.setProperty("--theme-radius", `${themeRadiusPx}px`);
  }, [themeRadiusPx]);

  const toggleFooterPaymentMethodKey = (key: string) => {
    setHiddenFooterPaymentMethodKeys((current) =>
      current.includes(key) ? current.filter((existing) => existing !== key) : [...current, key],
    );
  };

  const toggleFooterSocialLinkKey = (key: string) => {
    setHiddenFooterSocialLinkKeys((current) =>
      current.includes(key) ? current.filter((existing) => existing !== key) : [...current, key],
    );
  };

  const value = useMemo<LayoutPreferencesContextValue>(
    () => ({
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
      showBreadcrumbs,
      showNewsletterPopup,
      newsletterPopupVariant,
      newsletterPopupCooldownDays,
      brandPalette,
      brandGradientStyle,
      checkoutStoreMode,
      checkoutCouponPosition,
      checkoutPaymentPosition,
      checkoutSummaryPosition,
      checkoutHideOptionalBillingFields,
      checkoutHideOptionalShippingFields,
      checkoutShowOrderNotes,
      checkoutShowTerms,
      checkoutShowPrivacy,
      setShowAnnouncementBar,
      setAnnouncementBarScrollEffect,
      setHeaderSticky,
      setHeaderSearchVariant,
      setHeaderLogoVariant,
      setShowHeaderLogo,
      setShowHeaderSearchIcon,
      setShowHeaderLanguageSwitcher,
      setShowHeaderCurrencySwitcher,
      setShowHeaderDarkModeToggle,
      setShowHeaderAccountLink,
      setShowHeaderReadingListLink,
      setShowHeaderWishlistLink,
      setShowHeaderCartIcon,
      setCartTriggerVariant,
      setShowCartDrawerPromotedProduct,
      setShowFooter,
      setFooterColumnsLayout,
      setFooterNewsletterLayout,
      setShowFooterNewsletter,
      setFooterAssistantLayout,
      setFooterLogoVariant,
      setFooterBottomBarLayout,
      setFooterExtraWrapperLayout,
      setShowFooterLogo,
      setShowFooterExtraWrapper,
      setShowFooterSpotifyPlayer,
      setShowFooterAssistantFrame,
      setShowFooterPaymentMethods,
      setShowFooterSocialLinks,
      setShowFooterCopyright,
      toggleFooterPaymentMethodKey,
      toggleFooterSocialLinkKey,
      setThemeMaxWidthPx,
      setThemeRadiusPx,
      setShowBreadcrumbs,
      setShowNewsletterPopup,
      setNewsletterPopupVariant,
      setNewsletterPopupCooldownDays,
      setBrandPalette: chooseBrandPalette,
      setBrandGradientStyle: chooseBrandGradientStyle,
      setCheckoutStoreMode,
      setCheckoutCouponPosition,
      setCheckoutPaymentPosition,
      setCheckoutSummaryPosition,
      setCheckoutHideOptionalBillingFields,
      setCheckoutHideOptionalShippingFields,
      setCheckoutShowOrderNotes,
      setCheckoutShowTerms,
      setCheckoutShowPrivacy,
    }),
    [
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
      showBreadcrumbs,
      showNewsletterPopup,
      newsletterPopupVariant,
      newsletterPopupCooldownDays,
      brandPalette,
      brandGradientStyle,
      checkoutStoreMode,
      checkoutCouponPosition,
      checkoutPaymentPosition,
      checkoutSummaryPosition,
      checkoutHideOptionalBillingFields,
      checkoutHideOptionalShippingFields,
      checkoutShowOrderNotes,
      checkoutShowTerms,
      checkoutShowPrivacy,
      chooseBrandGradientStyle,
      chooseBrandPalette,
    ],
  );

  return <LayoutPreferencesContext.Provider value={value}>{children}</LayoutPreferencesContext.Provider>;
}

export function useLayoutPreferences() {
  const context = useContext(LayoutPreferencesContext);
  if (!context) throw new Error("useLayoutPreferences must be used within a LayoutPreferencesProvider");
  return context;
}
