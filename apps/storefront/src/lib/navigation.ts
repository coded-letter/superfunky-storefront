import {
  getLanguageFlagCode,
  isSupportedSocialPlatform,
  PAYMENT_METHODS,
  SOCIAL_LINKS,
  SOCIAL_PLATFORM_OPTIONS,
} from "@funky/ui/src/locale/options.ts";
import { normalizeLanguagePath } from "@funky/ui/src/locale/urlPaths.ts";
import type { BrandGradientStyle, BrandPaletteId } from "@funky/ui/src/state/brandPalettes.ts";
import type {
  CartTriggerVariant,
  HeaderLogoVariant,
  HeaderNavItem,
  HeaderSearchVariant,
} from "@funky/ui/src/layout/HeaderMockup.tsx";
import type {
  FooterAssistantLayout,
  FooterBottomBarLayout,
  FooterColumn,
  FooterColumnsLayout,
  FooterExtraWrapperLayout,
  FooterLogoVariant,
  FooterNewsletterLayout,
} from "@funky/ui/src/layout/FooterMockup.tsx";
import type { NewsletterPopupVariant } from "@funky/ui/src/layout/NewsletterSignupPopup.tsx";
import type { CurrencyOption, LanguageOption, SocialPlatform } from "@funky/ui/src/locale/options.ts";
import type { ProductPageLayout } from "@funky/ui/src/state/productPageLayout.ts";
import type { RelatedProductsColumns } from "@funky/ui/src/state/LayoutPreferencesContext.tsx";
import { BACKEND_ORIGIN, graphqlRequest, hasOnlyMissingGraphqlFields, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { mapBackendLanguages } from "./languageMapping.ts";
import { normalizeContentHref } from "./internalLinks.ts";
import { mapFooterColumns, mapMenuItems, type RawMenuItem } from "./menuMapping.ts";
import {
  resolveCompatibleBranding,
  type CompatibleBrandingQueryResult,
} from "./compatibleBranding.ts";
import { hasOnlyKnownNavigationResolverErrors } from "./navigationCompatibility.ts";

type RawMenu = {
  id: string;
  databaseId: number;
  name: string | null;
  slug: string | null;
  locations: string[] | null;
  menuItems: {
    nodes: RawMenuItem[];
  } | null;
};

type NavigationQueryResult = {
  menus: {
    nodes: RawMenu[];
  } | null;
  languages: { code: string; name: string; slug: string }[] | null;
  storefrontConfig: StorefrontConfiguration | null;
  uiStrings: string | null;
};

type StorefrontRuntimeQueryResult = {
  storefrontConfig: Pick<StorefrontConfiguration, "defaultCustomerCountry" | "shippingCountries" | "freeShippingZones" | "stripePublishableKey"> | null;
};

type StorefrontUiStringsQueryResult = {
  uiStrings: string | null;
};

type StorefrontRadioQueryResult = {
  storefrontConfig: {
    footer: {
      spotifyPlaylistUrl?: string | null;
      spotifyPlaylistEmbedUrl?: string | null;
      spotifyPlayerTitle?: string | null;
      spotifyPlayerDescription?: string | null;
    } | null;
  } | null;
};

export type NoPriceBehavior = "free" | "inquiry";
export type PrismTheme =
  | "one-light"
  | "one-dark"
  | "dracula"
  | "duotone-light"
  | "duotone-dark"
  | "prism"
  | "coy"
  | "dark"
  | "funky"
  | "okaidia"
  | "solarized-light"
  | "tomorrow"
  | "twilight";
export type PrismLightTheme = PrismTheme;
export type PrismDarkTheme = PrismTheme;

/**
 * Canonical, site-wide storefront layout configuration — mirrors the backend's
 * `FunkyCommerceLayout` GraphQL type (see `funkycommerce_layout_control_fields()` in
 * `inc/control-center-schema.php`). Backend values are authoritative for normal
 * storefront sessions; authenticated Layout Studio sessions may override them in memory.
 */
export type StorefrontLayoutConfiguration = {
  schemaVersion: number;
  themeMaxWidthPx: number;
  themeRadiusPx: number;
  showBreadcrumbs: boolean;
  brandPalette: BrandPaletteId;
  brandGradientStyle: BrandGradientStyle;
  showNewsletterPopup: boolean;
  newsletterPopupVariant: NewsletterPopupVariant;
  newsletterPopupCooldownDays: number;
  productPageLayout: ProductPageLayout;
  relatedProductsColumns: RelatedProductsColumns;
  showStudioRelatedProductsUnderMeta: boolean;
  checkoutStoreMode: "physical" | "digital";
  checkoutCouponPosition: "inline" | "top";
  checkoutPaymentPosition: "left" | "right";
  checkoutSummaryPosition: "sticky" | "static";
  checkoutHideOptionalBillingFields: boolean;
  checkoutHideOptionalShippingFields: boolean;
  checkoutShowOrderNotes: boolean;
  checkoutShowTerms: boolean;
  checkoutShowPrivacy: boolean;
  showAnnouncementBar: boolean;
  announcementBarScrollEffect: boolean;
  headerSticky: boolean;
  headerSearchVariant: HeaderSearchVariant;
  headerLogoVariant: HeaderLogoVariant;
  cartTriggerVariant: CartTriggerVariant;
  showCartDrawerPromotedProduct: boolean;
  showFooter: boolean;
  footerColumnsLayout: FooterColumnsLayout;
  footerNewsletterLayout: FooterNewsletterLayout;
  showFooterNewsletter: boolean;
  footerAssistantLayout: FooterAssistantLayout;
  footerLogoVariant: FooterLogoVariant;
  footerBottomBarLayout: FooterBottomBarLayout;
  footerExtraWrapperLayout: FooterExtraWrapperLayout;
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
  showFooterLogo: boolean;
  showFooterExtraWrapper: boolean;
  showFooterSpotifyPlayer: boolean;
  showFooterAssistantFrame: boolean;
  showFooterPaymentMethods: boolean;
  showFooterSocialLinks: boolean;
  showFooterCopyright: boolean;
  showFooterPaymentVisa: boolean;
  showFooterPaymentMastercard: boolean;
  showFooterPaymentPaypal: boolean;
  showFooterPaymentApay: boolean;
  showFooterPaymentGpay: boolean;
  showFooterPaymentStripe: boolean;
  showFooterPaymentBlik: boolean;
  showFooterPaymentBtc: boolean;
  showFooterPaymentEth: boolean;
  showFooterSocialBehance: boolean;
  showFooterSocialDiscord: boolean;
  showFooterSocialFacebook: boolean;
  showFooterSocialGithub: boolean;
  showFooterSocialGoogle: boolean;
  showFooterSocialInstagram: boolean;
  showFooterSocialLinkedin: boolean;
  showFooterSocialPatreon: boolean;
  showFooterSocialSlack: boolean;
  showFooterSocialTiktok: boolean;
  showFooterSocialTwitch: boolean;
  showFooterSocialTwitter: boolean;
  showFooterSocialX: boolean;
  showFooterSocialYoutube: boolean;
  homeHeroLayout: "classic" | "cinematic" | "cinematic-slider";
  shopProductCardVariant: "default" | "minimal" | "editorial" | "gallery" | "simple" | "variation" | "expandable";
  authLayout: "split" | "centered" | "image-bg";
  readingListLayout: "cards" | "editorial-2col";
  wishlistCardVariant: "default" | "minimal" | "editorial" | "gallery" | "simple" | "variation" | "expandable";
  communityFeedLayout: "masonry" | "grid-3" | "grid-4" | "list" | "compact";
  communityFeedLoadMode: "manual" | "infinite";
  communityFeedPageSize: "6" | "12" | "24";
  communityFeedFilters: "show" | "hide";
  communityProfileHeaderLayout: "card" | "cover-banner" | "compact-list" | "immersive" | "split" | "strip";
  authorProfileHeaderLayout: "card" | "cover-banner" | "compact-list" | "immersive" | "split" | "strip";
  cartLayout: "classic" | "editorial";
  cartSummaryPosition: "sticky" | "static";
  productArchiveHeroLayout: "split" | "fullbleed" | "minimal";
  postArchiveHeroLayout: "split" | "fullbleed" | "minimal";
  showArchiveDescriptionInHero: boolean;
  postTocLayout: "current" | "rail-left" | "rail-right" | "above";
  postSharePosition: "above-toc" | "on-image" | "below-toc-right";
  postAuthorLayout: "fullwidth" | "compact" | "editorial";
  discussionLayout: "stacked" | "split-left" | "split-right";
};

export type StorefrontConfiguration = {
  baseCurrency: string;
  rateMode: string;
  currencies: CurrencyOption[];
  defaultCustomerCountry?: string | null;
  shippingCountries?: Array<{ code: string; name: string }>;
  freeShippingZones?: Array<{
    countryCode: string;
    zoneName?: string | null;
    minAmount?: number | null;
    requires?: string | null;
    currencyCode?: string | null;
  }>;
  stripePublishableKey?: string | null;
  stripeCustomerPortalUrl?: string | null;
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
  headerIconMedia: {
    search?: string | null;
    theme?: string | null;
    account?: string | null;
    readingList?: string | null;
    wishlist?: string | null;
    cart?: string | null;
    menu?: string | null;
    assistant?: string | null;
  };
  aiAssistant: {
    enabled?: boolean;
    provider?: string;
    placement?: "footer" | "header" | "fixed";
    showHeader?: boolean;
    showFooter?: boolean;
    showFixed?: boolean;
    nativeProviderActive?: boolean;
    title?: string | null;
    subtitle?: string | null;
    greeting?: string | null;
    composerPlaceholder?: string | null;
    launcherLabel?: string | null;
    iframeUrl?: string | null;
    iframeTitle: string;
    iframeSandbox: string;
    iframeReferrerPolicy: string;
  };
  footer: {
    socialLinks: StorefrontSocialProfile[];
    newsletterHeading: string;
    newsletterText: string;
    newsletterPrivacyLabel: string;
    spotifyPlaylistUrl: string;
    spotifyPlaylistEmbedUrl: string;
    spotifyPlayerTitle: string;
    spotifyPlayerDescription: string;
    extraHtml: string;
    copyrightText: string;
  };
  recentOrders: {
    enabled: boolean;
    itemCount: number;
    intervalSeconds: number;
    quietSeconds: number;
    openLinksInNewTab: boolean;
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
  productPresentation: {
    noPriceBehavior: NoPriceBehavior;
    inquiryHeading: string;
    inquiryButtonLabel: string;
    inquiryCopy: string;
  };
  codeHighlighting: {
    lightTheme: PrismLightTheme;
    darkTheme: PrismDarkTheme;
  };
  checkout: {
    accountMode: "guest" | "optional" | "required";
    distractionFree: boolean;
    heading: string;
    intro: string;
    trustMessage: string;
    supportMessage: string;
    supportUrl?: string | null;
    marketingLabel: string;
    termsMessage: string;
    submitLabel: string;
  };
  layout: StorefrontLayoutConfiguration;
};

export type StorefrontSocialProfile = {
  id: string;
  platform: SocialPlatform;
  url: string;
  label: string;
};

export type CmsNavigationData = {
  header: HeaderNavItem[];
  mobile: HeaderNavItem[];
  footer: FooterColumn[];
  languages: LanguageOption[];
  storefrontConfig: StorefrontConfiguration;
  uiStrings: Record<string, string>;
};

export type CmsNavigationMenus = Pick<CmsNavigationData, "header" | "mobile" | "footer">;

/** Deterministic defaults for every layout field — always identical to the backend's
 * own `funkycommerce_layout_control_fields()` defaults, so a misconfigured or
 * unreachable backend still renders the theme's original, documented chrome. */
export const DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION: StorefrontLayoutConfiguration = {
  schemaVersion: 1,
  themeMaxWidthPx: 1280,
  themeRadiusPx: 16,
  showBreadcrumbs: true,
  brandPalette: "violet",
  brandGradientStyle: "gradient",
  showNewsletterPopup: true,
  newsletterPopupVariant: "split",
  newsletterPopupCooldownDays: 7,
  productPageLayout: "classic",
  relatedProductsColumns: "4",
  showStudioRelatedProductsUnderMeta: false,
  checkoutStoreMode: "physical",
  checkoutCouponPosition: "inline",
  checkoutPaymentPosition: "left",
  checkoutSummaryPosition: "sticky",
  checkoutHideOptionalBillingFields: false,
  checkoutHideOptionalShippingFields: false,
  checkoutShowOrderNotes: true,
  checkoutShowTerms: true,
  checkoutShowPrivacy: true,
  showAnnouncementBar: true,
  announcementBarScrollEffect: true,
  headerSticky: true,
  headerSearchVariant: "full-width",
  headerLogoVariant: "text-image",
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
  showFooterLogo: true,
  showFooterExtraWrapper: true,
  showFooterSpotifyPlayer: true,
  showFooterAssistantFrame: true,
  showFooterPaymentMethods: true,
  showFooterSocialLinks: true,
  showFooterCopyright: true,
  showFooterPaymentVisa: true,
  showFooterPaymentMastercard: true,
  showFooterPaymentPaypal: true,
  showFooterPaymentApay: true,
  showFooterPaymentGpay: true,
  showFooterPaymentStripe: true,
  showFooterPaymentBlik: true,
  showFooterPaymentBtc: true,
  showFooterPaymentEth: true,
  showFooterSocialBehance: true,
  showFooterSocialDiscord: true,
  showFooterSocialFacebook: true,
  showFooterSocialGithub: true,
  showFooterSocialGoogle: true,
  showFooterSocialInstagram: true,
  showFooterSocialLinkedin: true,
  showFooterSocialPatreon: true,
  showFooterSocialSlack: true,
  showFooterSocialTiktok: true,
  showFooterSocialTwitch: true,
  showFooterSocialTwitter: true,
  showFooterSocialX: true,
  showFooterSocialYoutube: true,
  homeHeroLayout: "classic",
  shopProductCardVariant: "default",
  authLayout: "split",
  readingListLayout: "cards",
  wishlistCardVariant: "default",
  communityFeedLayout: "grid-3",
  communityFeedLoadMode: "manual",
  communityFeedPageSize: "6",
  communityFeedFilters: "show",
  communityProfileHeaderLayout: "card",
  authorProfileHeaderLayout: "card",
  cartLayout: "classic",
  cartSummaryPosition: "sticky",
  productArchiveHeroLayout: "split",
  postArchiveHeroLayout: "split",
  showArchiveDescriptionInHero: false,
  postTocLayout: "current",
  postSharePosition: "above-toc",
  postAuthorLayout: "fullwidth",
  discussionLayout: "stacked",
};

export const DEFAULT_STOREFRONT_CONFIGURATION: StorefrontConfiguration = {
  baseCurrency: "EUR",
  rateMode: "manual",
  currencies: [{ code: "EUR", label: "EUR", symbol: "€", rate: 1 }],
  defaultCustomerCountry: null,
  shippingCountries: [],
  freeShippingZones: [],
  stripePublishableKey: null,
  stripeCustomerPortalUrl: null,
  branding: {
    storeName: "Superfunky",
    companyName: "Superfunky",
    tagline: "Modern storefront mockup",
    logoUrl: null,
    iconUrl: null,
    promoHtml: "",
  },
  headerIcons: {
    search: "search",
    theme: "moon",
    account: "user",
    push: "bell",
    readingList: "book-marked",
    wishlist: "heart",
    cart: "shopping-cart",
    menu: "menu",
    assistant: "message-circle",
  },
  headerIconMedia: {},
  aiAssistant: {
    enabled: false,
    provider: "native-first",
    placement: "footer",
    showHeader: false,
    showFooter: true,
    showFixed: false,
    nativeProviderActive: false,
    iframeUrl: null,
    iframeTitle: "AI Assistant",
    iframeSandbox: "allow-scripts allow-forms allow-popups",
    iframeReferrerPolicy: "strict-origin-when-cross-origin",
  },
  footer: {
    socialLinks: [],
    newsletterHeading: "",
    newsletterText: "",
    newsletterPrivacyLabel: "",
    spotifyPlaylistUrl: "",
    spotifyPlaylistEmbedUrl: "",
    spotifyPlayerTitle: "",
    spotifyPlayerDescription: "",
    extraHtml: "",
    copyrightText: "",
  },
  recentOrders: {
    enabled: false,
    itemCount: 5,
    intervalSeconds: 10,
    quietSeconds: 8,
    openLinksInNewTab: true,
  },
  features: {
    promo: true,
    search: true,
    languages: true,
    currencies: true,
    account: true,
    wishlist: true,
    readingList: true,
    cart: true,
    quickView: true,
    push: true,
    crypto: false,
  },
  productPresentation: {
    noPriceBehavior: "free",
    inquiryHeading: "Product inquiry",
    inquiryButtonLabel: "Ask about this product",
    inquiryCopy: "Send us a message and we will follow up with availability and pricing.",
  },
  codeHighlighting: {
    lightTheme: "one-light",
    darkTheme: "one-dark",
  },
  checkout: {
    accountMode: "optional",
    distractionFree: false,
    heading: "Secure checkout",
    intro: "Complete your details and choose a payment method to place your order.",
    trustMessage: "Encrypted payment · Clear totals · Secure processing",
    supportMessage: "Need help with your order? Contact our support team.",
    supportUrl: null,
    marketingLabel: "Keep me posted about new drops, offers, and restocks by email.",
    termsMessage: "By placing your order, you agree to the store terms and privacy policy.",
    submitLabel: "Place order",
  },
  layout: DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION,
};

const NAVIGATION_QUERY = /* GraphQL */ `
  query StorefrontNavigation($language: String) {
    uiStrings: funkycommerceUiStrings(language: $language)
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      baseCurrency
      rateMode
      currencies {
        code
        label
        symbol
        rate
      }

      branding {
        storeName
        companyName
        tagline
        logoUrl
        iconUrl
        promoHtml
      }
      headerIcons {
        search
        theme
        account
        readingList
        wishlist
        cart
        menu
        assistant
      }
      headerIconMedia {
        search
        theme
        account
        readingList
        wishlist
        cart
        menu
        assistant
      }
      footer {
        newsletterHeading
        newsletterText
        newsletterPrivacyLabel
        spotifyPlaylistUrl
        spotifyPlaylistEmbedUrl
        extraHtml
        copyrightText
        socialLinks {
          id
          platform
          url
          label
        }
      }
      recentOrders {
        enabled
        itemCount
        intervalSeconds
        quietSeconds
        openLinksInNewTab
      }
      features {
        promo
        search
        languages
        currencies
        account
        wishlist
        readingList
        cart
        quickView
        push
        crypto
      }
      productPresentation {
        noPriceBehavior
        inquiryHeading
        inquiryButtonLabel
        inquiryCopy
      }
      codeHighlighting {
        lightTheme
        darkTheme
      }
      stripeCustomerPortalUrl
      checkout {
        accountMode
        distractionFree
        heading
        intro
        trustMessage
        supportMessage
        supportUrl
        marketingLabel
        termsMessage
        submitLabel
      }
      layout {
        schemaVersion
        themeMaxWidthPx
        themeRadiusPx
        showBreadcrumbs
        brandPalette
        brandGradientStyle
        showNewsletterPopup
        newsletterPopupVariant
        newsletterPopupCooldownDays
        productPageLayout
        relatedProductsColumns
        showStudioRelatedProductsUnderMeta
        checkoutStoreMode
        checkoutCouponPosition
        checkoutPaymentPosition
        checkoutSummaryPosition
        checkoutHideOptionalBillingFields
        checkoutHideOptionalShippingFields
        checkoutShowOrderNotes
        checkoutShowTerms
        checkoutShowPrivacy
        showAnnouncementBar
        announcementBarScrollEffect
        headerSticky
        headerSearchVariant
        headerLogoVariant
        cartTriggerVariant
        showCartDrawerPromotedProduct
        showFooter
        footerColumnsLayout
        footerNewsletterLayout
        showFooterNewsletter
        footerAssistantLayout
        footerLogoVariant
        footerBottomBarLayout
        footerExtraWrapperLayout
        showHeaderLogo
        showHeaderSearchIcon
        showHeaderLanguageSwitcher
        showHeaderCurrencySwitcher
        showHeaderDarkModeToggle
        showHeaderAccountLink
        showHeaderReadingListLink
        showHeaderWishlistLink
        showHeaderCartIcon
        showHeaderPublishButton
        showFooterLogo
        showFooterExtraWrapper
        showFooterSpotifyPlayer
        showFooterAssistantFrame
        showFooterPaymentMethods
        showFooterSocialLinks
        showFooterCopyright
        showFooterPaymentVisa
        showFooterPaymentMastercard
        showFooterPaymentPaypal
        showFooterPaymentApay
        showFooterPaymentGpay
        showFooterPaymentStripe
        showFooterPaymentBlik
        showFooterPaymentBtc
        showFooterPaymentEth
        showFooterSocialBehance
        showFooterSocialDiscord
        showFooterSocialFacebook
        showFooterSocialGithub
        showFooterSocialGoogle
        showFooterSocialInstagram
        showFooterSocialLinkedin
        showFooterSocialPatreon
        showFooterSocialSlack
        showFooterSocialTiktok
        showFooterSocialTwitch
        showFooterSocialTwitter
        showFooterSocialX
        showFooterSocialYoutube
        homeHeroLayout
        shopProductCardVariant
        authLayout
        readingListLayout
        wishlistCardVariant
        communityFeedLayout
        communityFeedLoadMode
        communityFeedPageSize
        communityFeedFilters
        communityProfileHeaderLayout
        authorProfileHeaderLayout
        cartLayout
        cartSummaryPosition
        productArchiveHeroLayout
        postArchiveHeroLayout
        showArchiveDescriptionInHero
        postTocLayout
        postSharePosition
        postAuthorLayout
        discussionLayout
      }
    }
  }
`;

const LOCALIZED_NAVIGATION_MENUS_QUERY = /* GraphQL */ `
  query StorefrontLocalizedNavigationMenus {
    menus(first: 100) {
      nodes {
        ...StorefrontLocalizedMenu
      }
    }
  }

  fragment StorefrontLocalizedMenu on Menu {
    id
    databaseId
    name
    slug
    locations
    menuItems(first: 100) {
      nodes {
        id
        databaseId
        parentDatabaseId
        order
        label
        title
        description
        path
        uri
        url
        target
        cssClasses
        linkRelationship
      }
    }
  }
`;

const STOREFRONT_RADIO_QUERY = /* GraphQL */ `
  query StorefrontRadio($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      footer {
        spotifyPlaylistUrl
        spotifyPlaylistEmbedUrl
        spotifyPlayerTitle
        spotifyPlayerDescription
      }
    }
  }
`;

const LEGACY_STOREFRONT_RADIO_QUERY = /* GraphQL */ `
  query StorefrontRadioLegacy($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      footer {
        spotifyPlaylistUrl
        spotifyPlaylistEmbedUrl
      }
    }
  }
`;

const COMPATIBLE_NAVIGATION_QUERY = /* GraphQL */ `
 query StorefrontNavigationCompatible {
   menus(first: 100) {
     nodes {
       id
       databaseId
       name
       slug
       menuItems(first: 100) {
         nodes {
           id
           databaseId
           parentDatabaseId
           order
           label
           title
           description
           path
           uri
           url
           target
           cssClasses
           linkRelationship
         }
       }
     }
   }
 }
`;

const COMPATIBLE_BRANDING_QUERY = /* GraphQL */ `
  query StorefrontCompatibleBranding($language: String) {
    generalSettings {
      title
      description
    }
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      branding {
        storeName
        companyName
        tagline
        logoUrl
        iconUrl
        promoHtml
      }
    }
  }
`;

const STOREFRONT_RUNTIME_QUERY = /* GraphQL */ `
  query StorefrontRuntimeConfig($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      defaultCustomerCountry
      shippingCountries {
        code
        name
      }
      freeShippingZones {
        countryCode
        zoneName
        minAmount
        requires
        currencyCode
      }
      stripePublishableKey
    }
  }
`;

const STOREFRONT_AI_ASSISTANT_QUERY = /* GraphQL */ `
  query StorefrontAiAssistant($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      aiAssistant {
        enabled
        provider
        placement
        showHeader
        showFooter
        showFixed
        nativeProviderActive
        iframeUrl
        iframeTitle
        iframeSandbox
        iframeReferrerPolicy
      }
    }
  }
`;

const COMPATIBLE_STOREFRONT_AI_ASSISTANT_QUERY = /* GraphQL */ `
  query StorefrontAiAssistantCompatible($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      aiAssistant {
        enabled
        provider
        nativeProviderActive
        iframeUrl
        iframeTitle
        iframeSandbox
        iframeReferrerPolicy
      }
    }
  }
`;

const STOREFRONT_UI_STRINGS_QUERY = /* GraphQL */ `
  query StorefrontUiStrings($language: String) {
    uiStrings: funkycommerceUiStrings(language: $language)
  }
`;

const STOREFRONT_LANGUAGES_QUERY = /* GraphQL */ `
  query StorefrontLanguages {
    languages { code name slug }
  }
`;

const NAVIGATION_COMPATIBILITY_FIELDS = [
 "language",
 "languages",
 "menus",
 "menuItems",
 "locations",
 "uiStrings",
 "storefrontConfig",
 "funkycommerceUiStrings",
 "funkycommerceStorefrontConfig",
 "promoHtml",
 "assistant",
 "headerIconMedia",
 "aiAssistant",
 "extraHtml",
 "copyrightText",
 "quickView",
 "productPresentation",
 "codeHighlighting",
 "stripeCustomerPortalUrl",
 "spotifyPlayerTitle",
 "spotifyPlayerDescription",
 "layout",
 "LanguageCodeFilterEnum",
] as const;

export function omitUnsupportedLayoutFields(
  query: string,
  errors: { message: string }[] | undefined,
): string | null {
  const knownFields = new Set(Object.keys(DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION));
  const unsupported = new Set<string>();
  for (const { message } of errors ?? []) {
    const match = message.match(/(?:Cannot query field|Field) "(\w+)"[\s\S]*?(?:type )?"FunkyCommerceLayout"/i);
    if (match && knownFields.has(match[1])) unsupported.add(match[1]);
  }
  if (!unsupported.size) return null;

  let depth = 0;
  let layoutChildDepth: number | null = null;
  let removed = false;
  const lines = query.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (trimmed === "layout {") layoutChildDepth = depth + 1;
    if (layoutChildDepth !== null && depth === layoutChildDepth && unsupported.has(trimmed)) {
      removed = true;
      return false;
    }

    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
    if (layoutChildDepth !== null && depth < layoutChildDepth) layoutChildDepth = null;
    return true;
  });
  if (!removed) return null;

  return lines.join("\n").replace(/\n\s+layout \{\s*\}/, "");
}

function isNavigationCompatibilityError(
  errors: { message: string; extensions?: { debugMessage?: string } }[] | undefined,
): boolean {
 return hasOnlyMissingGraphqlFields(errors, NAVIGATION_COMPATIBILITY_FIELDS)
   || hasOnlyKnownNavigationResolverErrors(errors);
}

export function hasOnlyMenuSchemaCompatibilityErrors(
  errors: { message: string }[] | undefined,
): boolean {
  return hasOnlyMissingGraphqlFields(errors, ["menus", "menuItems", "locations"]);
}

const EMPTY_NAVIGATION_RESULT: NavigationQueryResult = {
 menus: { nodes: [] },
 languages: [],
 storefrontConfig: null,
 uiStrings: null,
};

type StorefrontLanguagesQueryResult = {
  languages: { code: string; name: string; slug: string; isDefault?: boolean }[] | null;
};

type PolylangRestLanguage = {
  name: string;
  slug: string;
  is_default?: boolean;
};

function mapNavigationLanguages(languages: StorefrontLanguagesQueryResult["languages"]): LanguageOption[] {
  return mapBackendLanguages(languages || []).map((language) => ({
    ...language,
    flagCode: getLanguageFlagCode(language.code),
  }));
}

async function getPolylangRestLanguages(
  signal?: AbortSignal,
): Promise<StorefrontLanguagesQueryResult["languages"]> {
  const response = await fetch(
    new URL("/wp-json/pll/v1/languages", BACKEND_ORIGIN),
    signal ? { signal } : undefined,
  );
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Polylang REST language discovery failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Polylang REST returned a non-array language payload");
  }
  return payload.flatMap((language: PolylangRestLanguage) => {
    const slug = typeof language?.slug === "string" ? language.slug.trim().toLowerCase() : "";
    const name = typeof language?.name === "string" ? language.name.trim() : "";
    return slug && name
      ? [{ code: slug.toUpperCase(), name, slug, isDefault: language.is_default === true }]
      : [];
  });
}

async function getOptionalPolylangRestLanguages(): Promise<StorefrontLanguagesQueryResult["languages"]> {
  try {
    return await getPolylangRestLanguages(AbortSignal.timeout(3_000));
  } catch (error) {
    console.warn(
      "Polylang REST language discovery was unavailable.",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function getStorefrontLanguages(): Promise<LanguageOption[]> {
  if (STOREFRONT_BACKEND_PROFILE === "shell") return [];
  if (STOREFRONT_BACKEND_PROFILE === "blog") {
    return mapNavigationLanguages(await getOptionalPolylangRestLanguages());
  }
  const graphqlResponse = await graphqlRequest<StorefrontLanguagesQueryResult>(STOREFRONT_LANGUAGES_QUERY);
  const { data, errors } = graphqlResponse;
  if (errors?.length) {
    if (isNavigationCompatibilityError(errors)) {
      return mapNavigationLanguages(await getOptionalPolylangRestLanguages());
    }
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) return [];
  return mapNavigationLanguages(data.languages);
}

async function getNavigationMenuData(): Promise<NavigationQueryResult> {
  let response = await graphqlRequest<NavigationQueryResult>(LOCALIZED_NAVIGATION_MENUS_QUERY);
  if (
    hasOnlyMenuSchemaCompatibilityErrors(response.errors)
    || hasOnlyKnownNavigationResolverErrors(response.errors)
  ) {
    response = await graphqlRequest<NavigationQueryResult>(COMPATIBLE_NAVIGATION_QUERY);
  }
  if (response.errors?.length) {
    throw new Error(response.errors.map(({ message }) => message).join("; "));
  }
  return response.data ?? EMPTY_NAVIGATION_RESULT;
}

export async function getNavigationMenus(
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): Promise<CmsNavigationMenus> {
  return resolveNavigationMenus(
    await getNavigationMenuData(),
    languageCode,
    configuredLanguageCodes,
  );
}

type StorefrontAiAssistantQueryResult = {
  storefrontConfig?: {
    aiAssistant?: StorefrontConfiguration["aiAssistant"] | null;
  } | null;
};

export async function getAiAssistantConfiguration(
  languageCode: string,
): Promise<StorefrontConfiguration["aiAssistant"] | null> {
  const variables = { language: languageCode.toLowerCase() };
  let response = await graphqlRequest<StorefrontAiAssistantQueryResult>(
    STOREFRONT_AI_ASSISTANT_QUERY,
    variables,
  );
  if (hasOnlyMissingGraphqlFields(response.errors, ["showHeader", "showFooter", "showFixed"])) {
    response = await graphqlRequest<StorefrontAiAssistantQueryResult>(
      COMPATIBLE_STOREFRONT_AI_ASSISTANT_QUERY,
      variables,
    );
  }
  if (response.errors?.length) {
    throw new Error(
      `AI assistant configuration was unavailable: ${response.errors.map(({ message }) => message).join("; ")}`,
    );
  }
  const configuration = response.data?.storefrontConfig?.aiAssistant ?? null;
  if (!configuration || configuration.showHeader != null) return configuration;
  return {
    ...configuration,
    placement: "footer",
    showHeader: false,
    showFooter: true,
    showFixed: false,
  };
}

export async function getNavigationData(languageCode: string): Promise<CmsNavigationData> {
  const variables = { language: languageCode.toLowerCase() };
  let [navigationResponse, menuData, runtimeResponse, uiStringsResponse, radioResponse, languages] = await Promise.all([
    graphqlRequest<NavigationQueryResult>(NAVIGATION_QUERY, variables),
    getNavigationMenuData(),
    graphqlRequest<StorefrontRuntimeQueryResult>(STOREFRONT_RUNTIME_QUERY, variables),
    graphqlRequest<StorefrontUiStringsQueryResult>(STOREFRONT_UI_STRINGS_QUERY, variables),
    graphqlRequest<StorefrontRadioQueryResult>(STOREFRONT_RADIO_QUERY, variables),
    getStorefrontLanguages(),
  ]);

  const compatibleLayoutQuery = omitUnsupportedLayoutFields(NAVIGATION_QUERY, navigationResponse.errors);
  if (compatibleLayoutQuery) {
    navigationResponse = await graphqlRequest<NavigationQueryResult>(compatibleLayoutQuery, variables);
  }

  if (isNavigationCompatibilityError(navigationResponse.errors)) {
    const brandingFallback = await graphqlRequest<CompatibleBrandingQueryResult>(
      COMPATIBLE_BRANDING_QUERY,
      { language: languageCode.toLowerCase() },
    );
    if (
      brandingFallback.errors?.length
      && !isNavigationCompatibilityError(brandingFallback.errors)
    ) {
      throw new Error(brandingFallback.errors.map(({ message }) => message).join("; "));
    }
    navigationResponse = {
      data: {
        storefrontConfig: {
          ...DEFAULT_STOREFRONT_CONFIGURATION,
          branding: resolveCompatibleBranding(
            brandingFallback.data,
            DEFAULT_STOREFRONT_CONFIGURATION.branding,
          ),
        },
      },
      errors: undefined,
    };
  }

  if (isNavigationCompatibilityError(runtimeResponse.errors)) {
    runtimeResponse = { data: null, errors: undefined };
  }
  if (isNavigationCompatibilityError(uiStringsResponse.errors)) {
    uiStringsResponse = { data: null, errors: undefined };
  }
  if (uiStringsResponse.errors?.length) {
    throw new Error(uiStringsResponse.errors.map(({ message }) => message).join("; "));
  }
  if (isNavigationCompatibilityError(radioResponse.errors)) {
    radioResponse = await graphqlRequest<StorefrontRadioQueryResult>(LEGACY_STOREFRONT_RADIO_QUERY, variables);
  }
  if (isNavigationCompatibilityError(radioResponse.errors)) {
    radioResponse = { data: null, errors: undefined };
  }
  if (radioResponse.errors?.length) {
    throw new Error(radioResponse.errors.map(({ message }) => message).join("; "));
  }

  const data = navigationResponse.data ?? EMPTY_NAVIGATION_RESULT;
  if (navigationResponse.errors?.length) {
    throw new Error(navigationResponse.errors.map(({ message }) => message).join("; "));
  }

  const languageCodes = languages.map(({ code }) => code);
  const { header, mobile, footer } = resolveNavigationMenus(menuData, languageCode, languageCodes);
  return {
    header,
    mobile,
    footer,
    languages,
    storefrontConfig: normalizeStorefrontConfiguration({
      ...(data.storefrontConfig || {}),
      ...(runtimeResponse.data?.storefrontConfig || {}),
      footer: {
        ...(data.storefrontConfig?.footer || {}),
        ...normalizeStorefrontRadioFooter(radioResponse.data?.storefrontConfig?.footer),
      },
    } as StorefrontConfiguration),
    uiStrings: parseUiStrings(uiStringsResponse.data?.uiStrings ?? data.uiStrings),
  };
}

function resolveNavigationMenus(
  data: NavigationQueryResult,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): CmsNavigationMenus {
  const menus = (data.menus?.nodes || []).filter((menu) => menu.menuItems?.nodes.length);
  const header = localizeMenu(
    mapBestAvailableMenu(menus, "HEADER", languageCode),
    languageCode,
    configuredLanguageCodes,
  );
  const mobile = localizeMenu(
    mapBestAvailableMenu(menus, "MOBILE", languageCode, ["HEADER"]),
    languageCode,
    configuredLanguageCodes,
  );
  const footer = localizeMenu(
    mapBestAvailableMenu(menus, "FOOTER", languageCode, ["HEADER", "MOBILE"]),
    languageCode,
    configuredLanguageCodes,
  );
  return {
    header,
    mobile: mobile.length ? mobile : header,
    footer: mapFooterColumns(footer.length ? footer : header),
  };
}

function localizeMenu(
  items: HeaderNavItem[],
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): HeaderNavItem[] {
  return items.map((item) => ({
    ...item,
    href: normalizeLanguagePath(item.href, languageCode, configuredLanguageCodes),
    children: item.children
      ? localizeMenu(item.children, languageCode, configuredLanguageCodes)
      : undefined,
  }));
}

export function parseUiStrings(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([key, value]) => key.trim().length > 0 && typeof value === "string",
        ),
      );
    }
  } catch {
    // Malformed JSON — fall through to empty map.
  }
  return {};
}

function normalizeStorefrontRadioFooter(
  footer: {
    spotifyPlaylistUrl?: string | null;
    spotifyPlaylistEmbedUrl?: string | null;
    spotifyPlayerTitle?: string | null;
    spotifyPlayerDescription?: string | null;
  } | null | undefined,
): Partial<StorefrontConfiguration["footer"]> {
  if (!footer) return {};
  return Object.fromEntries(
    Object.entries(footer).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function clampConfigurationInteger(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  return Number.isInteger(value) ? Math.max(min, Math.min(max, Number(value))) : fallback;
}

export function normalizeStorefrontConfiguration(configuration: StorefrontConfiguration | null): StorefrontConfiguration {
  if (!configuration) return DEFAULT_STOREFRONT_CONFIGURATION;
  return {
    baseCurrency: configuration.baseCurrency || DEFAULT_STOREFRONT_CONFIGURATION.baseCurrency,
    rateMode: configuration.rateMode || DEFAULT_STOREFRONT_CONFIGURATION.rateMode,
    currencies: Array.isArray(configuration.currencies) && configuration.currencies.length
      ? configuration.currencies
          .filter((currency) => currency?.code && currency?.symbol)
          .map((currency) => ({
            code: currency.code.toUpperCase(),
            label: currency.label || currency.code.toUpperCase(),
            symbol: currency.symbol,
            rate: Number.isFinite(currency.rate) ? currency.rate : 0,
          }))
      : DEFAULT_STOREFRONT_CONFIGURATION.currencies,
    defaultCustomerCountry:
      typeof configuration.defaultCustomerCountry === "string" && configuration.defaultCustomerCountry
        ? configuration.defaultCustomerCountry.toUpperCase()
        : DEFAULT_STOREFRONT_CONFIGURATION.defaultCustomerCountry,
    shippingCountries:
      Array.isArray(configuration.shippingCountries) && configuration.shippingCountries.length
        ? configuration.shippingCountries
            .filter((country) => country?.code && country?.name)
            .map((country) => ({ code: country.code.toUpperCase(), name: country.name }))
        : DEFAULT_STOREFRONT_CONFIGURATION.shippingCountries,
    freeShippingZones:
      Array.isArray(configuration.freeShippingZones) && configuration.freeShippingZones.length
        ? configuration.freeShippingZones
            .filter((zone) => zone?.countryCode)
            .map((zone) => ({
              countryCode: zone.countryCode.toUpperCase(),
              zoneName: zone.zoneName || null,
              minAmount: Number.isFinite(zone.minAmount) ? zone.minAmount : null,
              requires: zone.requires || null,
              currencyCode: zone.currencyCode?.toUpperCase() || null,
            }))
        : DEFAULT_STOREFRONT_CONFIGURATION.freeShippingZones,
    stripePublishableKey:
      typeof configuration.stripePublishableKey === "string" && configuration.stripePublishableKey.startsWith("pk_")
        ? configuration.stripePublishableKey
        : DEFAULT_STOREFRONT_CONFIGURATION.stripePublishableKey,
    stripeCustomerPortalUrl: normalizeExternalHttpUrl(configuration.stripeCustomerPortalUrl),
    branding: {
      ...DEFAULT_STOREFRONT_CONFIGURATION.branding,
      ...configuration.branding,
      promoHtml: typeof configuration.branding?.promoHtml === "string" ? configuration.branding.promoHtml : "",
    },
    headerIcons: { ...DEFAULT_STOREFRONT_CONFIGURATION.headerIcons, ...configuration.headerIcons },
    headerIconMedia: { ...DEFAULT_STOREFRONT_CONFIGURATION.headerIconMedia, ...configuration.headerIconMedia },
    aiAssistant: normalizeAssistantThemeConfiguration(configuration.aiAssistant),
    footer: {
      ...DEFAULT_STOREFRONT_CONFIGURATION.footer,
      ...configuration.footer,
      socialLinks: normalizeFooterSocialProfiles(configuration.footer?.socialLinks),
      extraHtml: typeof configuration.footer?.extraHtml === "string" ? configuration.footer.extraHtml : "",
      copyrightText: typeof configuration.footer?.copyrightText === "string" ? configuration.footer.copyrightText : "",
    },
    recentOrders: {
      enabled: configuration.recentOrders?.enabled === true,
      itemCount: clampConfigurationInteger(configuration.recentOrders?.itemCount, 1, 10, 5),
      intervalSeconds: clampConfigurationInteger(configuration.recentOrders?.intervalSeconds, 3, 300, 10),
      quietSeconds: clampConfigurationInteger(configuration.recentOrders?.quietSeconds, 2, 300, 8),
      openLinksInNewTab: configuration.recentOrders?.openLinksInNewTab !== false,
    },
    features: {
      ...DEFAULT_STOREFRONT_CONFIGURATION.features,
      ...configuration.features,
      quickView: typeof configuration.features?.quickView === "boolean" ? configuration.features.quickView : true,
      push: typeof configuration.features?.push === "boolean" ? configuration.features.push : true,
    },
    productPresentation: {
      ...DEFAULT_STOREFRONT_CONFIGURATION.productPresentation,
      ...configuration.productPresentation,
      noPriceBehavior: isNoPriceBehavior(configuration.productPresentation?.noPriceBehavior)
        ? configuration.productPresentation.noPriceBehavior
        : DEFAULT_STOREFRONT_CONFIGURATION.productPresentation.noPriceBehavior,
    },
    codeHighlighting: {
      lightTheme: isPrismLightTheme(configuration.codeHighlighting?.lightTheme)
        ? configuration.codeHighlighting.lightTheme
        : DEFAULT_STOREFRONT_CONFIGURATION.codeHighlighting.lightTheme,
      darkTheme: isPrismDarkTheme(configuration.codeHighlighting?.darkTheme)
        ? configuration.codeHighlighting.darkTheme
        : DEFAULT_STOREFRONT_CONFIGURATION.codeHighlighting.darkTheme,
    },
    checkout: {
      ...DEFAULT_STOREFRONT_CONFIGURATION.checkout,
      ...configuration.checkout,
      accountMode: ["guest", "optional", "required"].includes(configuration.checkout?.accountMode)
        ? configuration.checkout.accountMode
        : DEFAULT_STOREFRONT_CONFIGURATION.checkout.accountMode,
      distractionFree: configuration.checkout?.distractionFree === true,
    },
    layout: normalizeStorefrontLayoutConfiguration(configuration.layout),
  };
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickBoundedInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const BRAND_PALETTE_IDS = [
  "violet", "sunset", "ocean", "forest", "rose", "indigo", "coral", "teal", "amber", "berry",
  "slate", "mint", "plum", "citrus", "sky", "ember", "lagoon", "blush", "olive", "midnight",
] as const;

/**
 * Strictly normalizes the backend's `layout` object: every enum is checked against
 * its exact backend-defined allowlist, every number is clamped to its documented
 * bounds, and every boolean is coerced — any unexpected/missing value falls back to
 * `DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION`'s deterministic default rather than
 * propagating malformed data into the storefront's live chrome.
 */
export function normalizeStorefrontLayoutConfiguration(
  layout: Partial<StorefrontLayoutConfiguration> | null | undefined,
): StorefrontLayoutConfiguration {
  const defaults = DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION;
  const source = layout || {};
  return {
    schemaVersion: pickBoundedInt(source.schemaVersion, 1, Number.MAX_SAFE_INTEGER, defaults.schemaVersion),
    themeMaxWidthPx: pickBoundedInt(source.themeMaxWidthPx, 960, 1920, defaults.themeMaxWidthPx),
    themeRadiusPx: pickBoundedInt(source.themeRadiusPx, 0, 32, defaults.themeRadiusPx),
    showBreadcrumbs: pickBoolean(source.showBreadcrumbs, defaults.showBreadcrumbs),
    brandPalette: pickEnum(source.brandPalette, BRAND_PALETTE_IDS, defaults.brandPalette),
    brandGradientStyle: pickEnum(source.brandGradientStyle, ["gradient", "flat"] as const, defaults.brandGradientStyle),
    showNewsletterPopup: pickBoolean(source.showNewsletterPopup, defaults.showNewsletterPopup),
    newsletterPopupVariant: pickEnum(
      source.newsletterPopupVariant,
      ["split", "modern-card", "modern-center"] as const,
      defaults.newsletterPopupVariant,
    ),
    newsletterPopupCooldownDays: pickBoundedInt(source.newsletterPopupCooldownDays, 1, 365, defaults.newsletterPopupCooldownDays),
    productPageLayout: pickEnum(source.productPageLayout, ["classic", "studio"] as const, defaults.productPageLayout),
    relatedProductsColumns: pickEnum(source.relatedProductsColumns, ["2", "3", "4"] as const, defaults.relatedProductsColumns),
    showStudioRelatedProductsUnderMeta: pickBoolean(
      source.showStudioRelatedProductsUnderMeta,
      defaults.showStudioRelatedProductsUnderMeta,
    ),
    checkoutStoreMode: pickEnum(source.checkoutStoreMode, ["physical", "digital"] as const, defaults.checkoutStoreMode),
    checkoutCouponPosition: pickEnum(source.checkoutCouponPosition, ["inline", "top"] as const, defaults.checkoutCouponPosition),
    checkoutPaymentPosition: pickEnum(source.checkoutPaymentPosition, ["left", "right"] as const, defaults.checkoutPaymentPosition),
    checkoutSummaryPosition: pickEnum(source.checkoutSummaryPosition, ["sticky", "static"] as const, defaults.checkoutSummaryPosition),
    checkoutHideOptionalBillingFields: pickBoolean(source.checkoutHideOptionalBillingFields, defaults.checkoutHideOptionalBillingFields),
    checkoutHideOptionalShippingFields: pickBoolean(source.checkoutHideOptionalShippingFields, defaults.checkoutHideOptionalShippingFields),
    checkoutShowOrderNotes: pickBoolean(source.checkoutShowOrderNotes, defaults.checkoutShowOrderNotes),
    checkoutShowTerms: pickBoolean(source.checkoutShowTerms, defaults.checkoutShowTerms),
    checkoutShowPrivacy: pickBoolean(source.checkoutShowPrivacy, defaults.checkoutShowPrivacy),
    showAnnouncementBar: pickBoolean(source.showAnnouncementBar, defaults.showAnnouncementBar),
    announcementBarScrollEffect: pickBoolean(source.announcementBarScrollEffect, defaults.announcementBarScrollEffect),
    headerSticky: pickBoolean(source.headerSticky, defaults.headerSticky),
    headerSearchVariant: pickEnum(source.headerSearchVariant, ["full-width", "expandable"] as const, defaults.headerSearchVariant),
    headerLogoVariant: pickEnum(source.headerLogoVariant, ["text", "image", "text-image"] as const, defaults.headerLogoVariant),
    cartTriggerVariant: pickEnum(source.cartTriggerVariant, ["drawer", "dropdown"] as const, defaults.cartTriggerVariant),
    showCartDrawerPromotedProduct: pickBoolean(source.showCartDrawerPromotedProduct, defaults.showCartDrawerPromotedProduct),
    showFooter: pickBoolean(source.showFooter, defaults.showFooter),
    footerColumnsLayout: pickEnum(
      source.footerColumnsLayout,
      ["grid-4", "grid-2-wide", "accordion-single"] as const,
      defaults.footerColumnsLayout,
    ),
    footerNewsletterLayout: pickEnum(
      source.footerNewsletterLayout,
      ["banner", "centered", "image-bg"] as const,
      defaults.footerNewsletterLayout,
    ),
    showFooterNewsletter: pickBoolean(source.showFooterNewsletter, defaults.showFooterNewsletter),
    footerAssistantLayout: pickEnum(
      source.footerAssistantLayout,
      ["side-by-side", "tabbed", "stacked"] as const,
      defaults.footerAssistantLayout,
    ),
    footerLogoVariant: pickEnum(source.footerLogoVariant, ["text", "image", "text-image"] as const, defaults.footerLogoVariant),
    footerBottomBarLayout: pickEnum(source.footerBottomBarLayout, ["split", "centered"] as const, defaults.footerBottomBarLayout),
    footerExtraWrapperLayout: pickEnum(
      source.footerExtraWrapperLayout,
      ["inline", "full-bleed"] as const,
      defaults.footerExtraWrapperLayout,
    ),
    showHeaderLogo: pickBoolean(source.showHeaderLogo, defaults.showHeaderLogo),
    showHeaderSearchIcon: pickBoolean(source.showHeaderSearchIcon, defaults.showHeaderSearchIcon),
    showHeaderLanguageSwitcher: pickBoolean(source.showHeaderLanguageSwitcher, defaults.showHeaderLanguageSwitcher),
    showHeaderCurrencySwitcher: pickBoolean(source.showHeaderCurrencySwitcher, defaults.showHeaderCurrencySwitcher),
    showHeaderDarkModeToggle: pickBoolean(source.showHeaderDarkModeToggle, defaults.showHeaderDarkModeToggle),
    showHeaderAccountLink: pickBoolean(source.showHeaderAccountLink, defaults.showHeaderAccountLink),
    showHeaderReadingListLink: pickBoolean(source.showHeaderReadingListLink, defaults.showHeaderReadingListLink),
    showHeaderWishlistLink: pickBoolean(source.showHeaderWishlistLink, defaults.showHeaderWishlistLink),
    showHeaderCartIcon: pickBoolean(source.showHeaderCartIcon, defaults.showHeaderCartIcon),
    showHeaderPublishButton: pickBoolean(source.showHeaderPublishButton, defaults.showHeaderPublishButton),
    showFooterLogo: pickBoolean(source.showFooterLogo, defaults.showFooterLogo),
    showFooterExtraWrapper: pickBoolean(source.showFooterExtraWrapper, defaults.showFooterExtraWrapper),
    showFooterSpotifyPlayer: pickBoolean(source.showFooterSpotifyPlayer, defaults.showFooterSpotifyPlayer),
    showFooterAssistantFrame: pickBoolean(source.showFooterAssistantFrame, defaults.showFooterAssistantFrame),
    showFooterPaymentMethods: pickBoolean(source.showFooterPaymentMethods, defaults.showFooterPaymentMethods),
    showFooterSocialLinks: pickBoolean(source.showFooterSocialLinks, defaults.showFooterSocialLinks),
    showFooterCopyright: pickBoolean(source.showFooterCopyright, defaults.showFooterCopyright),
    showFooterPaymentVisa: pickBoolean(source.showFooterPaymentVisa, defaults.showFooterPaymentVisa),
    showFooterPaymentMastercard: pickBoolean(source.showFooterPaymentMastercard, defaults.showFooterPaymentMastercard),
    showFooterPaymentPaypal: pickBoolean(source.showFooterPaymentPaypal, defaults.showFooterPaymentPaypal),
    showFooterPaymentApay: pickBoolean(source.showFooterPaymentApay, defaults.showFooterPaymentApay),
    showFooterPaymentGpay: pickBoolean(source.showFooterPaymentGpay, defaults.showFooterPaymentGpay),
    showFooterPaymentStripe: pickBoolean(source.showFooterPaymentStripe, defaults.showFooterPaymentStripe),
    showFooterPaymentBlik: pickBoolean(source.showFooterPaymentBlik, defaults.showFooterPaymentBlik),
    showFooterPaymentBtc: pickBoolean(source.showFooterPaymentBtc, defaults.showFooterPaymentBtc),
    showFooterPaymentEth: pickBoolean(source.showFooterPaymentEth, defaults.showFooterPaymentEth),
    showFooterSocialBehance: pickBoolean(source.showFooterSocialBehance, defaults.showFooterSocialBehance),
    showFooterSocialDiscord: pickBoolean(source.showFooterSocialDiscord, defaults.showFooterSocialDiscord),
    showFooterSocialFacebook: pickBoolean(source.showFooterSocialFacebook, defaults.showFooterSocialFacebook),
    showFooterSocialGithub: pickBoolean(source.showFooterSocialGithub, defaults.showFooterSocialGithub),
    showFooterSocialGoogle: pickBoolean(source.showFooterSocialGoogle, defaults.showFooterSocialGoogle),
    showFooterSocialInstagram: pickBoolean(source.showFooterSocialInstagram, defaults.showFooterSocialInstagram),
    showFooterSocialLinkedin: pickBoolean(source.showFooterSocialLinkedin, defaults.showFooterSocialLinkedin),
    showFooterSocialPatreon: pickBoolean(source.showFooterSocialPatreon, defaults.showFooterSocialPatreon),
    showFooterSocialSlack: pickBoolean(source.showFooterSocialSlack, defaults.showFooterSocialSlack),
    showFooterSocialTiktok: pickBoolean(source.showFooterSocialTiktok, defaults.showFooterSocialTiktok),
    showFooterSocialTwitch: pickBoolean(source.showFooterSocialTwitch, defaults.showFooterSocialTwitch),
    showFooterSocialTwitter: pickBoolean(source.showFooterSocialTwitter, defaults.showFooterSocialTwitter),
    showFooterSocialX: pickBoolean(source.showFooterSocialX, defaults.showFooterSocialX),
    showFooterSocialYoutube: pickBoolean(source.showFooterSocialYoutube, defaults.showFooterSocialYoutube),
    homeHeroLayout: pickEnum(source.homeHeroLayout, ["classic", "cinematic", "cinematic-slider"] as const, defaults.homeHeroLayout),
    shopProductCardVariant: pickEnum(
      source.shopProductCardVariant,
      ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"] as const,
      defaults.shopProductCardVariant,
    ),
    authLayout: pickEnum(source.authLayout, ["split", "centered", "image-bg"] as const, defaults.authLayout),
    readingListLayout: pickEnum(source.readingListLayout, ["cards", "editorial-2col"] as const, defaults.readingListLayout),
    wishlistCardVariant: pickEnum(
      source.wishlistCardVariant,
      ["default", "minimal", "editorial", "gallery", "simple", "variation", "expandable"] as const,
      defaults.wishlistCardVariant,
    ),
    communityFeedLayout: pickEnum(
      source.communityFeedLayout,
      ["masonry", "grid-3", "grid-4", "list", "compact"] as const,
      defaults.communityFeedLayout,
    ),
    communityFeedLoadMode: pickEnum(source.communityFeedLoadMode, ["manual", "infinite"] as const, defaults.communityFeedLoadMode),
    communityFeedPageSize: pickEnum(source.communityFeedPageSize, ["6", "12", "24"] as const, defaults.communityFeedPageSize),
    communityFeedFilters: pickEnum(source.communityFeedFilters, ["show", "hide"] as const, defaults.communityFeedFilters),
    communityProfileHeaderLayout: pickEnum(
      source.communityProfileHeaderLayout,
      ["card", "cover-banner", "compact-list", "immersive", "split", "strip"] as const,
      defaults.communityProfileHeaderLayout,
    ),
    authorProfileHeaderLayout: pickEnum(
      source.authorProfileHeaderLayout,
      ["card", "cover-banner", "compact-list", "immersive", "split", "strip"] as const,
      defaults.authorProfileHeaderLayout,
    ),
    cartLayout: pickEnum(source.cartLayout, ["classic", "editorial"] as const, defaults.cartLayout),
    cartSummaryPosition: pickEnum(source.cartSummaryPosition, ["sticky", "static"] as const, defaults.cartSummaryPosition),
    productArchiveHeroLayout: pickEnum(
      source.productArchiveHeroLayout,
      ["split", "fullbleed", "minimal"] as const,
      defaults.productArchiveHeroLayout,
    ),
    postArchiveHeroLayout: pickEnum(
      source.postArchiveHeroLayout,
      ["split", "fullbleed", "minimal"] as const,
      defaults.postArchiveHeroLayout,
    ),
    showArchiveDescriptionInHero: pickBoolean(
      source.showArchiveDescriptionInHero,
      defaults.showArchiveDescriptionInHero,
    ),
    postTocLayout: pickEnum(
      source.postTocLayout,
      ["current", "rail-left", "rail-right", "above"] as const,
      defaults.postTocLayout,
    ),
    postSharePosition: pickEnum(
      source.postSharePosition,
      ["above-toc", "on-image", "below-toc-right"] as const,
      defaults.postSharePosition,
    ),
    postAuthorLayout: pickEnum(source.postAuthorLayout, ["fullwidth", "compact", "editorial"] as const, defaults.postAuthorLayout),
    discussionLayout: pickEnum(source.discussionLayout, ["stacked", "split-left", "split-right"] as const, defaults.discussionLayout),
  };
}

/** Maps the layout's per-provider `showFooterPayment*`/`showFooterSocial*` booleans
 * onto the `hiddenFooterPaymentMethodKeys`/`hiddenFooterSocialLinkKeys` arrays that
 * `LayoutPreferencesContext` (and `FooterMockup`) actually filter on — a provider is
 * "hidden" exactly when its individual show-boolean is `false`. */
export function mapLayoutToHiddenFooterKeys(layout: StorefrontLayoutConfiguration): {
  hiddenFooterPaymentMethodKeys: string[];
  hiddenFooterSocialLinkKeys: string[];
} {
  const paymentKeyToField: Record<string, keyof StorefrontLayoutConfiguration> = {
    visa: "showFooterPaymentVisa",
    mastercard: "showFooterPaymentMastercard",
    paypal: "showFooterPaymentPaypal",
    apay: "showFooterPaymentApay",
    gpay: "showFooterPaymentGpay",
    stripe: "showFooterPaymentStripe",
    blik: "showFooterPaymentBlik",
    btc: "showFooterPaymentBtc",
    eth: "showFooterPaymentEth",
  };
  const socialKeyToField: Record<string, keyof StorefrontLayoutConfiguration> = {
    behance: "showFooterSocialBehance",
    discord: "showFooterSocialDiscord",
    facebook: "showFooterSocialFacebook",
    github: "showFooterSocialGithub",
    google: "showFooterSocialGoogle",
    instagram: "showFooterSocialInstagram",
    linkedin: "showFooterSocialLinkedin",
    patreon: "showFooterSocialPatreon",
    slack: "showFooterSocialSlack",
    tiktok: "showFooterSocialTiktok",
    twitch: "showFooterSocialTwitch",
    twitter: "showFooterSocialTwitter",
    x: "showFooterSocialX",
    youtube: "showFooterSocialYoutube",
  };
  return {
    hiddenFooterPaymentMethodKeys: PAYMENT_METHODS
      .map(({ key }) => key)
      .filter((key) => paymentKeyToField[key] && layout[paymentKeyToField[key]] === false),
    hiddenFooterSocialLinkKeys: SOCIAL_LINKS
      .map(({ id }) => id)
      .filter((id) => socialKeyToField[id] && layout[socialKeyToField[id]] === false),
  };
}

function normalizeExternalHttpUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function isNoPriceBehavior(value: unknown): value is NoPriceBehavior {
  return value === "free" || value === "inquiry";
}

function isPrismLightTheme(value: unknown): value is PrismLightTheme {
  return isPrismTheme(value);
}

function isPrismDarkTheme(value: unknown): value is PrismDarkTheme {
  return isPrismTheme(value);
}

function isPrismTheme(value: unknown): value is PrismTheme {
  return value === "one-light"
    || value === "one-dark"
    || value === "dracula"
    || value === "duotone-light"
    || value === "duotone-dark"
    || value === "prism"
    || value === "coy"
    || value === "dark"
    || value === "funky"
    || value === "okaidia"
    || value === "solarized-light"
    || value === "tomorrow"
    || value === "twilight";
}

function normalizeAssistantThemeConfiguration(
  assistant: StorefrontConfiguration["aiAssistant"] | null | undefined,
): StorefrontConfiguration["aiAssistant"] {
  const defaults = DEFAULT_STOREFRONT_CONFIGURATION.aiAssistant;
  const placement = assistant?.placement;
  return {
    enabled: assistant?.enabled ?? defaults.enabled,
    provider: assistant?.provider || defaults.provider,
    placement:
      placement === "footer" || placement === "header" || placement === "fixed"
        ? placement
        : defaults.placement,
    showHeader: assistant?.showHeader ?? (placement === "header" ? true : defaults.showHeader),
    showFooter: assistant?.showFooter ?? (placement ? placement === "footer" : defaults.showFooter),
    showFixed: assistant?.showFixed ?? (placement === "fixed" ? true : defaults.showFixed),
    nativeProviderActive: assistant?.nativeProviderActive ?? defaults.nativeProviderActive,
    title: assistant?.title,
    subtitle: assistant?.subtitle,
    greeting: assistant?.greeting,
    composerPlaceholder: assistant?.composerPlaceholder,
    launcherLabel: assistant?.launcherLabel,
    iframeUrl: assistant?.iframeUrl?.trim() || defaults.iframeUrl,
    iframeTitle: assistant?.iframeTitle?.trim() || defaults.iframeTitle,
    iframeSandbox: assistant?.iframeSandbox?.trim() || defaults.iframeSandbox,
    iframeReferrerPolicy: assistant?.iframeReferrerPolicy?.trim() || defaults.iframeReferrerPolicy,
  };
}

export function normalizeFooterSocialProfiles(profiles: StorefrontSocialProfile[] | null | undefined): StorefrontSocialProfile[] {
  if (!Array.isArray(profiles)) return [];

  const usedIds = new Set<string>();
  return profiles.flatMap((profile, index) => {
    if (
      !profile ||
      typeof profile.id !== "string" ||
      typeof profile.platform !== "string" ||
      typeof profile.url !== "string" ||
      typeof profile.label !== "string" ||
      !isSupportedSocialPlatform(profile.platform) ||
      !/^https?:\/\/\S+$/i.test(profile.url)
    ) {
      return [];
    }

    let id = profile.id.trim();
    if (!id) return [];
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    const defaultLabel = SOCIAL_PLATFORM_OPTIONS.find(({ key }) => key === profile.platform)?.label ?? profile.platform;
    return [{
      id,
      platform: profile.platform,
      url: profile.url,
      label: profile.label.trim() || defaultLabel,
    }];
  });
}

type MenuLocation = "HEADER" | "MOBILE" | "FOOTER";

const MENU_LOCATION_HINTS: Record<MenuLocation, string[]> = {
  HEADER: ["header", "main", "primary", "desktop", "top", "navigation", "nav"],
  MOBILE: ["mobile", "hamburger", "mobile-menu", "menu", "nav"],
  FOOTER: ["footer", "bottom", "links", "legal", "support"],
};

export function mapBestAvailableMenu(
  menus: RawMenu[],
  location: MenuLocation,
  languageCode: string,
  fallbackLocations: MenuLocation[] = [],
): HeaderNavItem[] {
  const locationPriority = [location, ...fallbackLocations];
  const ranked = menus
    .map((menu, index) => ({
      menu,
      index,
      score: scoreMenu(menu, locationPriority, languageCode),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  for (const { menu } of ranked) {
    const mapped = mapMenuItems(menu.menuItems?.nodes || [], normalizeMenuHref);
    if (mapped.length) return mapped;
  }
  return [];
}

export function scoreMenu(menu: RawMenu, locations: MenuLocation[], languageCode: string): number {
  const assignedLocations = new Set([
    ...(menu.locations || []),
    ...(menu.menuItems?.nodes.flatMap((item) => item.locations || []) || []),
  ]);
  const language = languageCode.toUpperCase();
  const searchableName = `${menu.name || ""} ${menu.slug || ""}`.toUpperCase();

  for (let index = 0; index < locations.length; index += 1) {
    const location = locations[index];
    const priority = (locations.length - index) * 100;
    if (assignedLocations.has(`${location}___${language}`)) return priority + 30;
    if (assignedLocations.has(location)) return priority + 20;
    if ([...assignedLocations].some((assigned) => assigned.startsWith(`${location}___`))) return priority + 10;
    if (searchableName.includes(location)) return priority + 5;

    const hintScore = MENU_LOCATION_HINTS[location].reduce((score, keyword) => {
      if (searchableName.includes(keyword.toUpperCase())) return score + 1;
      return score;
    }, 0);
    if (hintScore > 0) return priority + 4 + hintScore;
  }

  if (!assignedLocations.size) {
    const fallbackBoost = (menu.menuItems?.nodes.length ?? 0) + 1;
    return 2 + fallbackBoost;
  }

  return 1;
}

function normalizeMenuHref(value: string | null, parentHref: string | undefined): string {
  const href = value?.trim();
  if (!href) return "#";
  if (href.startsWith("#")) {
    const parentPath = parentHref?.split("#")[0];
    return parentPath && parentPath !== "#" ? `${parentPath}${href}` : href;
  }
  if (href.startsWith("/")) return href;

  const storefrontOrigin = typeof window !== "undefined"
    ? window.location.origin
    : (() => {
        const environment = (
          globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
        ).process?.env;
        return environment?.VITE_SITE_URL
          || environment?.URL
          || environment?.DEPLOY_PRIME_URL
          || "http://localhost";
      })();
  return normalizeContentHref(href, {
    storefrontOrigin,
    backendOrigin: BACKEND_ORIGIN,
    baseUrl: BACKEND_ORIGIN || storefrontOrigin,
  });
}
