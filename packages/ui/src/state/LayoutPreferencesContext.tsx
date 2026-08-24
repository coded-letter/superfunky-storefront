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
import type { ProfileHeaderLayout } from "../social/ProfileHeader";
import type { ProductCardVariant } from "../catalog/ProductCard";
import { applyBrandPalette, type BrandGradientStyle, type BrandPaletteId } from "./brandPalettes";
import type { ProductPageLayout } from "./productPageLayout";

/** Archive-page hero treatment shared by the product and post taxonomy archive pages. */
export type ArchiveHeroLayout = "split" | "fullbleed" | "minimal";
/** Where a journal post's table of contents renders relative to its content. */
export type PostTocLayout = "current" | "rail-left" | "rail-right" | "above";
/** Where a journal post's share buttons render. */
export type PostSharePosition = "above-toc" | "on-image" | "below-toc-right";
/** How a journal post's author card renders. */
export type PostAuthorLayout = "fullwidth" | "compact" | "editorial";
/** Shared comments/reviews discussion-thread layout, used on posts, products, and community content. */
export type DiscussionLayout = "stacked" | "split-left" | "split-right";
export type HomeHeroLayout = "classic" | "cinematic" | "cinematic-slider";
export type AuthLayout = "split" | "centered" | "image-bg";
export type ReadingListLayout = "cards" | "editorial-2col";
export type CommunityFeedLayout = "masonry" | "grid-3" | "grid-4" | "list" | "compact";
export type CommunityFeedLoadMode = "manual" | "infinite";
export type CommunityFeedPageSize = "6" | "12" | "24";
export type CommunityFeedFilters = "show" | "hide";
export type CartLayout = "classic" | "editorial";
export type CartSummaryPosition = "sticky" | "static";
export type RelatedProductsColumns = "2" | "3" | "4";

/**
 * Site-wide chrome layout preferences (header search style, header icon visibility,
 * footer column/newsletter/assistant layouts) — hydrated one-directionally from the
 * backend's canonical `funkycommerceStorefrontConfig.layout` (see
 * `apps/storefront/src/lib/layoutPreferencesSync.ts`) so every visitor sees the
 * storefront's Control Center-configured chrome deterministically. Intentionally
 * session-only (not persisted to localStorage, unlike wishlist/reading-list/theme)
 * since it mirrors backend configuration rather than a customer-facing setting.
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
  showHeaderPublishButton: boolean;
  /** `"drawer"` (default, current) opens the full slide-in side panel. `"dropdown"`
   * opens a compact popover anchored under the header's cart icon instead. */
  cartTriggerVariant: CartTriggerVariant;
  /** Whole cart-drawer "you might like" promoted-product suggestion, shown while the
   * drawer is empty, on/off. `true` (default). */
  showCartDrawerPromotedProduct: boolean;
  /** When enabled, empty-cart recommendations include every featured product instead
   * of only the first one. `false` by default for backwards-compatible payload size. */
  showAllCartPromotedProducts: boolean;
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
  /** Social-link `id`s hidden one by one, independent of the whole-row
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
  productPageLayout: ProductPageLayout;
  relatedProductsColumns: RelatedProductsColumns;
  showStudioRelatedProductsUnderMeta: boolean;
  homeHeroLayout: HomeHeroLayout;
  shopProductCardVariant: ProductCardVariant;
  authLayout: AuthLayout;
  readingListLayout: ReadingListLayout;
  wishlistCardVariant: ProductCardVariant;
  communityFeedLayout: CommunityFeedLayout;
  communityFeedLoadMode: CommunityFeedLoadMode;
  communityFeedPageSize: CommunityFeedPageSize;
  communityFeedFilters: CommunityFeedFilters;
  cartLayout: CartLayout;
  cartSummaryPosition: CartSummaryPosition;
  checkoutStoreMode: "physical" | "digital";
  checkoutCouponPosition: "inline" | "top";
  checkoutPaymentPosition: "left" | "right";
  checkoutSummaryPosition: "sticky" | "static";
  checkoutHideOptionalBillingFields: boolean;
  checkoutHideOptionalShippingFields: boolean;
  checkoutShowOrderNotes: boolean;
  checkoutShowTerms: boolean;
  checkoutShowPrivacy: boolean;
  /** Public community-member profile header — shared with `authorProfileHeaderLayout`
   * via the same `ProfileHeader` component. `"card"` (default) matches the original
   * gradient-card treatment. */
  communityProfileHeaderLayout: ProfileHeaderLayout;
  /** Journal author public-profile header — same six variants as the community
   * profile header. `"card"` (default). */
  authorProfileHeaderLayout: ProfileHeaderLayout;
  /** Hero treatment on product category/tag/brand archive pages. `"split"` (default). */
  productArchiveHeroLayout: ArchiveHeroLayout;
  /** Hero treatment on blog category/tag archive pages. `"split"` (default). */
  postArchiveHeroLayout: ArchiveHeroLayout;
  /** Show a three-line taxonomy-description excerpt in archive heroes. Full content
   * remains below the grid either way. `false` (default). */
  showArchiveDescriptionInHero: boolean;
  /** Table-of-contents placement on a single journal post. `"current"` (default). */
  postTocLayout: PostTocLayout;
  /** Share-button placement on a single journal post. `"above-toc"` (default). */
  postSharePosition: PostSharePosition;
  /** Author-card layout on a single journal post. `"fullwidth"` (default). */
  postAuthorLayout: PostAuthorLayout;
  /** Shared comments/reviews discussion layout on posts, products, and community
   * content. `"stacked"` (default). */
  discussionLayout: DiscussionLayout;
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
  showHeaderPublishButton: true,
  cartTriggerVariant: "drawer",
  showCartDrawerPromotedProduct: true,
  showAllCartPromotedProducts: false,
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
  productPageLayout: "classic",
  relatedProductsColumns: "4",
  showStudioRelatedProductsUnderMeta: false,
  homeHeroLayout: "classic",
  shopProductCardVariant: "default",
  authLayout: "split",
  readingListLayout: "cards",
  wishlistCardVariant: "default",
  communityFeedLayout: "grid-3",
  communityFeedLoadMode: "manual",
  communityFeedPageSize: "6",
  communityFeedFilters: "show",
  cartLayout: "classic",
  cartSummaryPosition: "sticky",
  checkoutStoreMode: "physical",
  checkoutCouponPosition: "inline",
  checkoutPaymentPosition: "left",
  checkoutSummaryPosition: "sticky",
  checkoutHideOptionalBillingFields: false,
  checkoutHideOptionalShippingFields: false,
  checkoutShowOrderNotes: true,
  checkoutShowTerms: true,
  checkoutShowPrivacy: true,
  communityProfileHeaderLayout: "card",
  authorProfileHeaderLayout: "card",
  productArchiveHeroLayout: "split",
  postArchiveHeroLayout: "split",
  showArchiveDescriptionInHero: false,
  postTocLayout: "current",
  postSharePosition: "above-toc",
  postAuthorLayout: "fullwidth",
  discussionLayout: "stacked",
};

type LayoutPreferencesContextValue = LayoutPreferencesState & {
  isLayoutPreviewActive: boolean;
  setLayoutPreviewActive: (value: boolean) => void;
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
  setShowHeaderPublishButton: (value: boolean) => void;
  setCartTriggerVariant: (value: CartTriggerVariant) => void;
  setShowCartDrawerPromotedProduct: (value: boolean) => void;
  setShowAllCartPromotedProducts: (value: boolean) => void;
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
  /** Toggles a single social-link ID in/out of `hiddenFooterSocialLinkKeys`. */
  toggleFooterSocialLinkKey: (key: string) => void;
  /** Replaces the whole `hiddenFooterPaymentMethodKeys` array — used to hydrate this
   * context from the backend's per-provider `showFooterPayment*` booleans. */
  setHiddenFooterPaymentMethodKeys: (keys: string[]) => void;
  /** Replaces the whole `hiddenFooterSocialLinkKeys` array — used to hydrate this
   * context from the backend's per-provider `showFooterSocial*` booleans. */
  setHiddenFooterSocialLinkKeys: (keys: string[]) => void;
  setThemeMaxWidthPx: (value: number) => void;
  setThemeRadiusPx: (value: number) => void;
  setShowBreadcrumbs: (value: boolean) => void;
  setShowNewsletterPopup: (value: boolean) => void;
  setNewsletterPopupVariant: (value: NewsletterPopupVariant) => void;
  setNewsletterPopupCooldownDays: (value: number) => void;
  setBrandPalette: (value: BrandPaletteId) => void;
  setBrandGradientStyle: (value: BrandGradientStyle) => void;
  syncBrandPalette: (value: BrandPaletteId) => void;
  syncBrandGradientStyle: (value: BrandGradientStyle) => void;
  setProductPageLayout: (value: ProductPageLayout) => void;
  setRelatedProductsColumns: (value: RelatedProductsColumns) => void;
  setShowStudioRelatedProductsUnderMeta: (value: boolean) => void;
  setHomeHeroLayout: (value: HomeHeroLayout) => void;
  setShopProductCardVariant: (value: ProductCardVariant) => void;
  setAuthLayout: (value: AuthLayout) => void;
  setReadingListLayout: (value: ReadingListLayout) => void;
  setWishlistCardVariant: (value: ProductCardVariant) => void;
  setCommunityFeedLayout: (value: CommunityFeedLayout) => void;
  setCommunityFeedLoadMode: (value: CommunityFeedLoadMode) => void;
  setCommunityFeedPageSize: (value: CommunityFeedPageSize) => void;
  setCommunityFeedFilters: (value: CommunityFeedFilters) => void;
  setCartLayout: (value: CartLayout) => void;
  setCartSummaryPosition: (value: CartSummaryPosition) => void;
  setCheckoutStoreMode: (value: "physical" | "digital") => void;
  setCheckoutCouponPosition: (value: "inline" | "top") => void;
  setCheckoutPaymentPosition: (value: "left" | "right") => void;
  setCheckoutSummaryPosition: (value: "sticky" | "static") => void;
  setCheckoutHideOptionalBillingFields: (value: boolean) => void;
  setCheckoutHideOptionalShippingFields: (value: boolean) => void;
  setCheckoutShowOrderNotes: (value: boolean) => void;
  setCheckoutShowTerms: (value: boolean) => void;
  setCheckoutShowPrivacy: (value: boolean) => void;
  setCommunityProfileHeaderLayout: (value: ProfileHeaderLayout) => void;
  setAuthorProfileHeaderLayout: (value: ProfileHeaderLayout) => void;
  setProductArchiveHeroLayout: (value: ArchiveHeroLayout) => void;
  setPostArchiveHeroLayout: (value: ArchiveHeroLayout) => void;
  setShowArchiveDescriptionInHero: (value: boolean) => void;
  setPostTocLayout: (value: PostTocLayout) => void;
  setPostSharePosition: (value: PostSharePosition) => void;
  setPostAuthorLayout: (value: PostAuthorLayout) => void;
  setDiscussionLayout: (value: DiscussionLayout) => void;
};

const LayoutPreferencesContext = createContext<LayoutPreferencesContextValue | null>(null);

export function LayoutPreferencesProvider({ children }: { children: ReactNode }) {
  const [isLayoutPreviewActive, setLayoutPreviewActive] = useState(false);
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
  const [showHeaderPublishButton, setShowHeaderPublishButton] = useState(DEFAULT_LAYOUT_PREFERENCES.showHeaderPublishButton);
  const [cartTriggerVariant, setCartTriggerVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.cartTriggerVariant);
  const [showCartDrawerPromotedProduct, setShowCartDrawerPromotedProduct] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showCartDrawerPromotedProduct,
  );
  const [showAllCartPromotedProducts, setShowAllCartPromotedProducts] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showAllCartPromotedProducts,
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
  const [brandPalette, syncBrandPalette] = useState(DEFAULT_LAYOUT_PREFERENCES.brandPalette);
  const [brandGradientStyle, syncBrandGradientStyle] = useState(DEFAULT_LAYOUT_PREFERENCES.brandGradientStyle);
  const [productPageLayout, setProductPageLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.productPageLayout);
  const [relatedProductsColumns, setRelatedProductsColumns] = useState(
    DEFAULT_LAYOUT_PREFERENCES.relatedProductsColumns,
  );
  const [showStudioRelatedProductsUnderMeta, setShowStudioRelatedProductsUnderMeta] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showStudioRelatedProductsUnderMeta,
  );
  const [homeHeroLayout, setHomeHeroLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.homeHeroLayout);
  const [shopProductCardVariant, setShopProductCardVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.shopProductCardVariant);
  const [authLayout, setAuthLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.authLayout);
  const [readingListLayout, setReadingListLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.readingListLayout);
  const [wishlistCardVariant, setWishlistCardVariant] = useState(DEFAULT_LAYOUT_PREFERENCES.wishlistCardVariant);
  const [communityFeedLayout, setCommunityFeedLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.communityFeedLayout);
  const [communityFeedLoadMode, setCommunityFeedLoadMode] = useState(DEFAULT_LAYOUT_PREFERENCES.communityFeedLoadMode);
  const [communityFeedPageSize, setCommunityFeedPageSize] = useState(DEFAULT_LAYOUT_PREFERENCES.communityFeedPageSize);
  const [communityFeedFilters, setCommunityFeedFilters] = useState(DEFAULT_LAYOUT_PREFERENCES.communityFeedFilters);
  const [cartLayout, setCartLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.cartLayout);
  const [cartSummaryPosition, setCartSummaryPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.cartSummaryPosition);
  const [checkoutStoreMode, setCheckoutStoreMode] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutStoreMode);
  const [checkoutCouponPosition, setCheckoutCouponPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutCouponPosition);
  const [checkoutPaymentPosition, setCheckoutPaymentPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutPaymentPosition);
  const [checkoutSummaryPosition, setCheckoutSummaryPosition] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutSummaryPosition);
  const [checkoutHideOptionalBillingFields, setCheckoutHideOptionalBillingFields] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutHideOptionalBillingFields);
  const [checkoutHideOptionalShippingFields, setCheckoutHideOptionalShippingFields] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutHideOptionalShippingFields);
  const [checkoutShowOrderNotes, setCheckoutShowOrderNotes] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowOrderNotes);
  const [checkoutShowTerms, setCheckoutShowTerms] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowTerms);
  const [checkoutShowPrivacy, setCheckoutShowPrivacy] = useState(DEFAULT_LAYOUT_PREFERENCES.checkoutShowPrivacy);
  const [communityProfileHeaderLayout, setCommunityProfileHeaderLayout] = useState(
    DEFAULT_LAYOUT_PREFERENCES.communityProfileHeaderLayout,
  );
  const [authorProfileHeaderLayout, setAuthorProfileHeaderLayout] = useState(
    DEFAULT_LAYOUT_PREFERENCES.authorProfileHeaderLayout,
  );
  const [productArchiveHeroLayout, setProductArchiveHeroLayout] = useState(
    DEFAULT_LAYOUT_PREFERENCES.productArchiveHeroLayout,
  );
  const [postArchiveHeroLayout, setPostArchiveHeroLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.postArchiveHeroLayout);
  const [showArchiveDescriptionInHero, setShowArchiveDescriptionInHero] = useState(
    DEFAULT_LAYOUT_PREFERENCES.showArchiveDescriptionInHero,
  );
  const [postTocLayout, setPostTocLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.postTocLayout);
  const [postSharePosition, setPostSharePosition] = useState(DEFAULT_LAYOUT_PREFERENCES.postSharePosition);
  const [postAuthorLayout, setPostAuthorLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.postAuthorLayout);
  const [discussionLayout, setDiscussionLayout] = useState(DEFAULT_LAYOUT_PREFERENCES.discussionLayout);
  const [hasBrandPaletteOverride, setHasBrandPaletteOverride] = useState(false);
  const chooseBrandPalette = useCallback((value: BrandPaletteId) => {
    syncBrandPalette(value);
    setHasBrandPaletteOverride(true);
  }, []);
  const chooseBrandGradientStyle = useCallback((value: BrandGradientStyle) => {
    syncBrandGradientStyle(value);
    setHasBrandPaletteOverride(true);
  }, []);

  useEffect(() => {
    if (!hasBrandPaletteOverride) return;
    applyBrandPalette(brandPalette, brandGradientStyle);
  }, [brandGradientStyle, brandPalette, hasBrandPaletteOverride]);

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
      isLayoutPreviewActive,
      setLayoutPreviewActive,
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
      showHeaderPublishButton,
      cartTriggerVariant,
      showCartDrawerPromotedProduct,
      showAllCartPromotedProducts,
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
      productPageLayout,
      relatedProductsColumns,
      showStudioRelatedProductsUnderMeta,
      homeHeroLayout,
      shopProductCardVariant,
      authLayout,
      readingListLayout,
      wishlistCardVariant,
      communityFeedLayout,
      communityFeedLoadMode,
      communityFeedPageSize,
      communityFeedFilters,
      cartLayout,
      cartSummaryPosition,
      checkoutStoreMode,
      checkoutCouponPosition,
      checkoutPaymentPosition,
      checkoutSummaryPosition,
      checkoutHideOptionalBillingFields,
      checkoutHideOptionalShippingFields,
      checkoutShowOrderNotes,
      checkoutShowTerms,
      checkoutShowPrivacy,
      communityProfileHeaderLayout,
      authorProfileHeaderLayout,
      productArchiveHeroLayout,
      postArchiveHeroLayout,
      showArchiveDescriptionInHero,
      postTocLayout,
      postSharePosition,
      postAuthorLayout,
      discussionLayout,
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
      setShowHeaderPublishButton,
      setCartTriggerVariant,
      setShowCartDrawerPromotedProduct,
      setShowAllCartPromotedProducts,
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
      setHiddenFooterPaymentMethodKeys,
      setHiddenFooterSocialLinkKeys,
      setThemeMaxWidthPx,
      setThemeRadiusPx,
      setShowBreadcrumbs,
      setShowNewsletterPopup,
      setNewsletterPopupVariant,
      setNewsletterPopupCooldownDays,
      setBrandPalette: chooseBrandPalette,
      setBrandGradientStyle: chooseBrandGradientStyle,
      syncBrandPalette,
      syncBrandGradientStyle,
      setProductPageLayout,
      setRelatedProductsColumns,
      setShowStudioRelatedProductsUnderMeta,
      setHomeHeroLayout,
      setShopProductCardVariant,
      setAuthLayout,
      setReadingListLayout,
      setWishlistCardVariant,
      setCommunityFeedLayout,
      setCommunityFeedLoadMode,
      setCommunityFeedPageSize,
      setCommunityFeedFilters,
      setCartLayout,
      setCartSummaryPosition,
      setCheckoutStoreMode,
      setCheckoutCouponPosition,
      setCheckoutPaymentPosition,
      setCheckoutSummaryPosition,
      setCheckoutHideOptionalBillingFields,
      setCheckoutHideOptionalShippingFields,
      setCheckoutShowOrderNotes,
      setCheckoutShowTerms,
      setCheckoutShowPrivacy,
      setCommunityProfileHeaderLayout,
      setAuthorProfileHeaderLayout,
      setProductArchiveHeroLayout,
      setPostArchiveHeroLayout,
      setShowArchiveDescriptionInHero,
      setPostTocLayout,
      setPostSharePosition,
      setPostAuthorLayout,
      setDiscussionLayout,
    }),
    [
      isLayoutPreviewActive,
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
      showHeaderPublishButton,
      cartTriggerVariant,
      showCartDrawerPromotedProduct,
      showAllCartPromotedProducts,
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
      productPageLayout,
      relatedProductsColumns,
      showStudioRelatedProductsUnderMeta,
      homeHeroLayout,
      shopProductCardVariant,
      authLayout,
      readingListLayout,
      wishlistCardVariant,
      communityFeedLayout,
      communityFeedLoadMode,
      communityFeedPageSize,
      communityFeedFilters,
      cartLayout,
      cartSummaryPosition,
      checkoutStoreMode,
      checkoutCouponPosition,
      checkoutPaymentPosition,
      checkoutSummaryPosition,
      checkoutHideOptionalBillingFields,
      checkoutHideOptionalShippingFields,
      checkoutShowOrderNotes,
      checkoutShowTerms,
      checkoutShowPrivacy,
      communityProfileHeaderLayout,
      authorProfileHeaderLayout,
      productArchiveHeroLayout,
      postArchiveHeroLayout,
      showArchiveDescriptionInHero,
      postTocLayout,
      postSharePosition,
      postAuthorLayout,
      discussionLayout,
      chooseBrandGradientStyle,
      chooseBrandPalette,
      syncBrandGradientStyle,
      syncBrandPalette,
    ],
  );

  return <LayoutPreferencesContext.Provider value={value}>{children}</LayoutPreferencesContext.Provider>;
}

export function useLayoutPreferences() {
  const context = useContext(LayoutPreferencesContext);
  if (!context) throw new Error("useLayoutPreferences must be used within a LayoutPreferencesProvider");
  return context;
}
