import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { brandPaletteCssVariables } from "../../../packages/ui/src/state/brandPalettes.mjs";
import {
  createWordPressElementTypographyCss,
  sanitizeWordPressFontFaces,
  sanitizeWordPressGlobalStyles,
  sanitizeWordPressStylesheetUrls,
  WORDPRESS_BLOCK_COMPATIBILITY_CSS,
} from "../src/lib/pageStyles.ts";
import { staticStyleSourceHash } from "../src/lib/staticStyleContract.mjs";
import { withStorefrontEditorPolicy } from "./security-policy.mjs";
import { normalizeStaticShortcodes } from "../src/lib/staticShortcodeMarkup.mjs";
import { addDefaultCmsIconDimensions } from "../src/lib/cmsIconSizing.mjs";
import { localizeStaticFontAssets } from "./static-font-assets.mjs";
import { stripBootstrapOverlay } from "./static-html.mjs";
import { classifyPageRouteKeys } from "../src/lib/storefrontRouteClassification.ts";
import { sanitizeCmsHtml, sanitizeCmsStyleAttribute } from "../src/lib/cmsBehaviors.ts";
import { storefrontProxiedMediaUrl } from "../src/lib/storefrontMediaAssets.ts";
import { mapMenuItems } from "../src/lib/menuMapping.ts";
import { getMegaMenuConfiguration } from "../../../packages/ui/src/layout/menuClasses.ts";
import {
  canUseHomepageBlogSummary,
  canUseHomepageCommunityFeed,
  resolveBackendDataRequirements,
} from "../src/lib/backendDataRequirements.ts";
import {
  cmsRouteFromNode,
  normalizedRoutePath,
  normalizeLanguageRoutePath,
  prerenderRouteDirectoryPath,
} from "./route-paths.mjs";
import {
  hasOnlyMissingField,
  hasOnlyMissingRootField,
  hasOnlyUnknownTypes,
} from "./optional-graphql.mjs";
import { buildCoreRoutesQuery, buildRoutesQuery } from "./route-query.mjs";
import {
  artifactConfigFromEnvironment,
  artifactProxyRedirects,
  createShellManifest,
  publishShellManifestForMode,
} from "./artifact-publish.mjs";
import { stableRouteIsAvailable } from "./route-availability.mjs";
import { navigationDataCacheKey } from "../src/lib/navigationCacheKey.mjs";

const staticNavigationRuntimeSource = await readFile(
  new URL("../src/lib/staticNavigationRuntime.js", import.meta.url),
  "utf8",
);
const outputDirectory = resolve("dist");
const template = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const environmentSiteUrl = (process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL)?.replace(/\/+$/, "");
const graphqlRequestOrigin = environmentSiteUrl ? new URL(environmentSiteUrl).origin : "";
const configuredSiteHostname = environmentSiteUrl ? new URL(environmentSiteUrl).hostname : "";
const configuredBackendHostname = process.env.VITE_GRAPHQL_ENDPOINT
  ? new URL(process.env.VITE_GRAPHQL_ENDPOINT).hostname
  : "";
const hasInteractiveStaticChrome = [configuredSiteHostname, configuredBackendHostname].some(
  (hostname) => hostname === "superfunky.pro" || hostname.endsWith(".superfunky.pro"),
);
const graphqlEndpoint = process.env.VITE_GRAPHQL_ENDPOINT?.trim();
let defaultLanguage = process.env.VITE_DEFAULT_LANGUAGE?.trim().toLowerCase() || "en";
const configuredBackendProfile = process.env.VITE_BACKEND_PROFILE?.trim().toLowerCase() || "full";
const backendProfile = ["shell", "blog", "shop", "full"].includes(configuredBackendProfile)
  ? configuredBackendProfile
  : "full";
const commerceRoutesAvailable = backendProfile === "shop" || backendProfile === "full";
const COMMERCE_ROUTE_TYPES = ["Product", "ProductBrand", "ProductCategory", "ProductTag"];
const expectedLanguages = (process.env.STOREFRONT_EXPECTED_LOCALES || "")
  .split(",")
  .map((locale) => locale.trim().toLowerCase())
  .filter((locale) => /^[a-z]{2}(?:-[a-z0-9]+)*$/.test(locale));
const artifactConfig = artifactConfigFromEnvironment();
let artifactDelivery = null;
const publicMediaProxyRoutes = new Map();
let backendLanguageFieldsAvailable = true;
let staticHydrationAssets = new Map();
let staticRouteRegistryAsset = null;
let staticPageHydrationAssets = new Map();
const STATIC_HYDRATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const stableRoutes = [
  { path: "/", lang: "en", title: "FunkyCommerce", description: "A modern storefront experience for shopping, stories, and community.", indexable: true },
  { path: "/shop", lang: "en", title: "Shop | FunkyCommerce", description: "Browse the latest FunkyCommerce products and collections.", indexable: true },
  { path: "/product-brand", lang: "en", title: "Product brands | FunkyCommerce", description: "Browse every brand with products available in the FunkyCommerce catalog.", type: "ProductBrandDirectory", indexable: true },
  { path: "/blog", lang: "en", title: "Journal | FunkyCommerce", description: "Stories, guides, and inspiration from FunkyCommerce.", indexable: true },
  { path: "/author", lang: "en", title: "Authors | FunkyCommerce", description: "Meet the authors publishing stories on FunkyCommerce.", type: "AuthorDirectory", indexable: true },
  { path: "/sitemap", lang: "en", title: "Sitemap | FunkyCommerce", description: "Browse every public URL available in the latest generated site build.", indexable: true },
  { path: "/cart", lang: "en", title: "Cart | FunkyCommerce", description: "Review the products in your FunkyCommerce cart.", indexable: false },
  { path: "/checkout", lang: "en", title: "Checkout | FunkyCommerce", description: "Complete your FunkyCommerce order securely.", indexable: false },
  { path: "/account", lang: "en", title: "My account | FunkyCommerce", description: "Manage your FunkyCommerce account and orders.", indexable: false },
  { path: "/wishlist", lang: "en", title: "Wishlist | FunkyCommerce", description: "View your saved FunkyCommerce products.", indexable: false },
  { path: "/reading-list", lang: "en", title: "Reading list | FunkyCommerce", description: "Return to your saved FunkyCommerce stories.", indexable: false },
  { path: "/community", lang: "en", title: "Community | FunkyCommerce", description: "Discover creators and conversations in the FunkyCommerce community.", indexable: true },
  { path: "/community-author", lang: "en", title: "Community authors | FunkyCommerce", description: "Discover public creators and collaborators publishing community content.", type: "CommunityAuthorDirectory", indexable: true },
  { path: "/community-tag", lang: "en", title: "Community tags | FunkyCommerce", description: "Browse every tag used by published community posts.", type: "CommunityTagDirectory", indexable: true },
  { path: "/auth", lang: "en", title: "Sign in | FunkyCommerce", description: "Sign in to your FunkyCommerce account.", indexable: false },
  { path: "/order-success", lang: "en", title: "Order confirmed | FunkyCommerce", description: "Your FunkyCommerce order has been confirmed.", indexable: false },
  { path: "/order-success/digital", lang: "en", title: "Digital order downloads | FunkyCommerce", description: "Access the downloads for your completed digital order.", indexable: false },
  { path: "/unsubscribe", lang: "en", title: "Email preferences | FunkyCommerce", description: "Update your FunkyCommerce email preferences.", indexable: false },
];

const ROUTE_SEO_SUPPORT_QUERY = `
  query StorefrontRouteSeoSupport {
    posts(first: 1) {
      nodes {
        seo { title }
      }

    }
  }
`;

const PUBLIC_ROBOTS_SUPPORT_QUERY = `
  query StorefrontPublicRobotsSupport {
    pages(first: 1) {
      nodes {
        funkycommercePublicRobots { noindex nofollow }
      }
    }
  }
`;

const LANGUAGES_QUERY = `
  query StorefrontLanguages {
    languages { code slug }
  }
`;

const STOREFRONT_CONFIG_LANGUAGES_QUERY = `
  query StorefrontConfigLanguages {
    storefrontConfig: funkycommerceStorefrontConfig {
      languages { code name }
    }
  }
`;

const STATIC_GENERATION_CONFIG_QUERY = `
  query StorefrontStaticGenerationConfig {
    funkycommerceStaticGenerationConfig
  }
`;

const STATIC_CHROME_QUERY = `
  query StorefrontStaticChrome($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      branding {
        storeName
        tagline
        logoUrl
      }
      layout {
        brandPalette
        brandGradientStyle
        themeMaxWidthPx
      }
    }
    themeStyles: funkycommerceThemeStyles {
      customCss
      fontFaceStyles
      globalStyles
      stylesheets
      colors { slug color }
    }
  }
`;

const STATIC_CHROME_DECORATION_QUERY = `
  query StorefrontStaticChromeDecoration($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      branding {
        iconUrl
        promoHtml
      }
      layout {
        showAnnouncementBar
        announcementBarScrollEffect
        showBreadcrumbs
      }
    }
    menus(first: 100) {
      nodes {
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
            locations
          }
        }
      }
    }
  }
`;

const STATIC_HEADER_CONTROLS_QUERY = `
  query StorefrontStaticHeaderControls($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      baseCurrency
      currencies { code symbol }
      features {
        search
        languages
        currencies
        account
        push
        readingList
        wishlist
        cart
      }
      headerIcons {
        search
        theme
        account
        readingList
        wishlist
        cart
        menu
      }
      headerIconMedia {
        search
        theme
        account
        readingList
        wishlist
        cart
        menu
      }
      layout {
        headerSearchVariant
        mobileMenuWidth
        mobileMenuHeight
        showCodeControls
        showHeaderSearchIcon
        showHeaderLanguageSwitcher
        showHeaderCurrencySwitcher
        showHeaderDarkModeToggle
        showHeaderAccountLink
        showHeaderReadingListLink
        showHeaderWishlistLink
        showHeaderCartIcon
      }
    }
  }
`;

const STATIC_HEADER_ASSISTANT_QUERY = `
  query StorefrontStaticHeaderAssistant($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      aiAssistant {
        enabled
        placement
        showHeader
        showFixed
      }
      headerIcons { assistant }
      headerIconMedia { assistant }
    }
  }
`;

const STATIC_FOOTER_CREDIT_QUERY = `
  query StorefrontStaticFooterCredit($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      footer {
        themeCredit
        showThemeCredit
      }
    }
  }
`;

const STATIC_LAYOUT_VARIANTS_QUERY = `
  query StorefrontStaticLayoutVariants($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      layout {
        headerArrangement
        footerColumnsLayout
      }
    }
  }
`;

const STATIC_RECENT_ORDERS_QUERY = `
  query StorefrontStaticRecentOrders($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      recentOrders {
        enabled
        itemCount
        intervalSeconds
        quietSeconds
        openLinksInNewTab
      }
    }
  }
`;

const STATIC_RECENT_ORDERS_CADENCE_QUERY = `
  query StorefrontStaticRecentOrdersCadence($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      recentOrders {
        enabled
        itemCount
        intervalSeconds
        quietSeconds
      }
    }
  }
`;

const STATIC_RECENT_ORDERS_LEGACY_QUERY = `
  query StorefrontStaticRecentOrdersLegacy($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      recentOrders {
        enabled
        itemCount
        intervalSeconds
      }
    }
  }
`;

const STATIC_PAYMENT_GATEWAYS_QUERY = `
  query StorefrontStaticPaymentGateways {
    paymentGateways {
      nodes {
        id
        title
        description
      }
    }
    storefrontConfig: funkycommerceStorefrontConfig {
      payments {
        blikEnabled
      }
      cryptoAssets {
        code
        label
        network
        wallet
        fiatRate
        qrUrl
      }
    }
  }
`;

const DEFAULT_STATIC_HEADER_CONTROLS = {
  baseCurrency: "EUR",
  currencySymbol: "€",
  features: {
    search: true,
    languages: true,
    currencies: true,
    account: true,
    push: true,
    readingList: true,
    wishlist: true,
    cart: true,
  },
  layout: {
    headerSearchVariant: "full-width",
    mobileMenuWidth: "standard",
    mobileMenuHeight: "full",
    showCodeControls: true,
    showHeaderSearchIcon: true,
    showHeaderLanguageSwitcher: true,
    showHeaderCurrencySwitcher: true,
    showHeaderDarkModeToggle: true,
    showHeaderAccountLink: true,
    showHeaderReadingListLink: true,
    showHeaderWishlistLink: true,
    showHeaderCartIcon: true,
  },
  assistant: {
    enabled: false,
    showHeader: false,
    showFixed: false,
    launcherLabel: "Open AI Assistant",
  },
  icons: {
    search: "search",
    theme: "moon",
    account: "user",
    readingList: "book-marked",
    wishlist: "heart",
    cart: "shopping-cart",
    menu: "menu",
    assistant: "message-circle",
  },
  media: {},
};

const DEFAULT_STATIC_CHROME = {
  storeName: "FunkyCommerce",
  tagline: "Modern storefront",
  logoUrl: "",
  iconUrl: "",
  promoHtml: "",
  showAnnouncementBar: false,
  announcementBarScrollEffect: true,
  showBreadcrumbs: true,
  navigationMenus: [],
  navigationItems: [],
  brandPalette: "violet",
  brandGradientStyle: "gradient",
  themeMaxWidthPx: 1280,
  headerArrangement: "classic",
  footerColumnsLayout: "grid-4",
  customCss: "",
  fontFaceStyles: "",
  globalStyles: "",
  stylesheets: [],
  colors: [],
  headerControls: DEFAULT_STATIC_HEADER_CONTROLS,
  themeCredit: 'Made with <a href="https://superfunky.pro" target="_blank" rel="noopener noreferrer">superfuky WP theme</a> by <a href="https://codedletter.com" target="_blank" rel="noopener noreferrer">Coded Letter</a>.',
  showThemeCredit: true,
  recentOrders: {
    enabled: false,
    itemCount: 5,
    intervalSeconds: 10,
    quietSeconds: 8,
    openLinksInNewTab: true,
  },
  paymentGatewayCache: {
    gateways: [],
    blikEnabled: false,
    cryptoAssets: [],
  },
};

const COMMUNITY_BUILD_MEMBERS_QUERY = `
  query StorefrontCommunityBuildMembers {
    communityMembers {
      databaseId
      name
      communityHandle
      communityRole
      communityProfilePublic
    }
  }
`;

const COMMUNITY_BUILD_POSTS_QUERY = `
  query StorefrontCommunityBuildPosts($after: String, $language: LanguageCodeFilterEnum) {
    communityPosts(first: 100, after: $after, where: { status: PUBLISH, language: $language }) {
      nodes {
        communityTags { nodes { name slug } }
        author { node { databaseId } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COMPATIBLE_COMMUNITY_BUILD_POSTS_QUERY = `
  query StorefrontCompatibleCommunityBuildPosts($after: String) {
    communityPosts(first: 100, after: $after, where: { status: PUBLISH }) {
      nodes {
        communityTags { nodes { name slug } }
        author { node { databaseId } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const DEFAULT_CSP = "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'inline-speculation-rules' https: blob:; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' 'inline-speculation-rules' https: blob:; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' https: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const DEFAULT_SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(self)",
  "Content-Security-Policy": DEFAULT_CSP,
};

const DEFAULT_STATIC_GENERATION_CONFIG = {
  frontendUrl: "",
  buildBadgeId: "",
  sitemapEnabled: true,
  robotsEnabled: true,
  robotsTxt: "User-agent: *\nAllow: /",
  llmsEnabled: false,
  llmsTxt: "",
  llmsFullEnabled: false,
  llmsFullTxt: "",
  aiBrandVoiceEnabled: false,
  aiBrandVoice: "",
  aiProductsEnabled: false,
  aiProductsJsonld: "{}",
  aiRankingEnabled: false,
  aiRankingSignals: "",
  aiFaqEnabled: false,
  aiFaqJson: "[]",
  aiDefenseEnabled: false,
  aiDefenseTxt: "",
  appleMerchantFile: "",
  redirectRules: "[]",
  securityHeadersEnabled: true,
  securityHeaders: JSON.stringify(DEFAULT_SECURITY_HEADERS),
  gtmContainerId: "",
  headScripts: "",
  bodyScripts: "",
  footerScripts: "",
};

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeAttributeEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function frontendUrl(value, fallbackPath = "/") {
  if (!effectiveSiteUrl) return value || "";
  if (!value) return `${effectiveSiteUrl}${fallbackPath === "/" ? "" : fallbackPath}`;
  try {
    const parsed = new URL(value, effectiveSiteUrl);
    return `${effectiveSiteUrl}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
  } catch {
    return `${effectiveSiteUrl}${fallbackPath === "/" ? "" : fallbackPath}`;
  }
}

function renderSeoHead(route) {
  const canonical = frontendUrl(route.canonical, route.path);
  const description = route.description?.trim() || "Explore FunkyCommerce.";
  const title = route.title?.trim() || "FunkyCommerce";
  const robots = route.robots || (route.indexable ? "index, follow" : "noindex, follow");
  const image = route.image;
  const imageType = image?.type || imageTypeFromUrl(image?.url);
  const tags = [
    `<title data-storefront-seo>${escapeAttribute(title)}</title>`,
    `<meta data-storefront-seo name="description" content="${escapeAttribute(description)}" />`,
    route.keywords ? `<meta data-storefront-seo name="keywords" content="${escapeAttribute(route.keywords)}" />` : "",
    `<meta data-storefront-seo name="robots" content="${escapeAttribute(robots)}" />`,
    route.opengraphAuthor ? `<meta data-storefront-seo name="author" content="${escapeAttribute(route.opengraphAuthor)}" />` : "",
    canonical ? `<link data-storefront-seo rel="canonical" href="${escapeAttribute(canonical)}" />` : "",
    `<meta data-storefront-seo property="og:type" content="${escapeAttribute(route.opengraphType || "website")}" />`,
    `<meta data-storefront-seo property="og:title" content="${escapeAttribute(route.opengraphTitle || title)}" />`,
    `<meta data-storefront-seo property="og:description" content="${escapeAttribute(route.opengraphDescription || description)}" />`,
    canonical ? `<meta data-storefront-seo property="og:url" content="${escapeAttribute(canonical)}" />` : "",
    `<meta data-storefront-seo property="og:site_name" content="${escapeAttribute(route.opengraphSiteName || "FunkyCommerce")}" />`,
    `<meta data-storefront-seo property="og:locale" content="${escapeAttribute(route.lang || defaultLanguage)}" />`,
    image ? `<meta data-storefront-seo property="og:image" content="${escapeAttribute(image.url)}" />` : "",
    image?.url?.startsWith("https://") ? `<meta data-storefront-seo property="og:image:secure_url" content="${escapeAttribute(image.url)}" />` : "",
    imageType ? `<meta data-storefront-seo property="og:image:type" content="${escapeAttribute(imageType)}" />` : "",
    image?.width ? `<meta data-storefront-seo property="og:image:width" content="${image.width}" />` : "",
    image?.height ? `<meta data-storefront-seo property="og:image:height" content="${image.height}" />` : "",
    image?.alt ? `<meta data-storefront-seo property="og:image:alt" content="${escapeAttribute(image.alt)}" />` : "",
    route.opengraphPublishedTime ? `<meta data-storefront-seo property="article:published_time" content="${escapeAttribute(route.opengraphPublishedTime)}" />` : "",
    route.opengraphModifiedTime ? `<meta data-storefront-seo property="article:modified_time" content="${escapeAttribute(route.opengraphModifiedTime)}" />` : "",
    route.opengraphAuthor ? `<meta data-storefront-seo property="article:author" content="${escapeAttribute(route.opengraphAuthor)}" />` : "",
    route.opengraphPublisher ? `<meta data-storefront-seo property="article:publisher" content="${escapeAttribute(route.opengraphPublisher)}" />` : "",
    `<meta data-storefront-seo name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta data-storefront-seo name="twitter:title" content="${escapeAttribute(route.twitterTitle || route.opengraphTitle || title)}" />`,
    `<meta data-storefront-seo name="twitter:description" content="${escapeAttribute(route.twitterDescription || route.opengraphDescription || description)}" />`,
    image ? `<meta data-storefront-seo name="twitter:image" content="${escapeAttribute(image.url)}" />` : "",
    image?.alt ? `<meta data-storefront-seo name="twitter:image:alt" content="${escapeAttribute(image.alt)}" />` : "",
  ].filter(Boolean);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": route.schemaType || (route.opengraphType === "article" ? "Article" : "WebPage"),
    name: title,
    ...(route.opengraphType === "article" ? { headline: route.opengraphTitle || title } : {}),
    description,
    url: canonical || undefined,
    inLanguage: route.lang || defaultLanguage,
    image: image
      ? {
          "@type": "ImageObject",
          url: image.url,
          contentUrl: image.url,
          width: image.width,
          height: image.height,
          caption: image.alt || undefined,
        }
      : undefined,
    datePublished: route.opengraphPublishedTime || undefined,
    dateModified: route.opengraphModifiedTime || undefined,
    author: route.opengraphAuthor ? { "@type": "Person", name: route.opengraphAuthor } : undefined,
  };
  tags.push(`<script data-storefront-seo type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>`);
  if (route.breadcrumbs?.length) {
    const breadcrumbData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: route.breadcrumbs.map((breadcrumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: breadcrumb.name,
        item: frontendUrl(breadcrumb.url),
      })),
    };
    tags.push(`<script data-storefront-seo type="application/ld+json">${JSON.stringify(breadcrumbData).replaceAll("<", "\\u003c")}</script>`);
  }
  return tags.join("\n    ");
}

function imageTypeFromUrl(value) {
  const extension = value?.match(/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  if (!extension) return "";
  if (extension === "jpg") return "image/jpeg";
  return `image/${extension}`;
}

class GraphqlResponseError extends Error {
  constructor(errors) {
    super(errors.map(({ message }) => message).join("; "));
    this.name = "GraphqlResponseError";
    this.errors = errors;
  }
}

async function requestGraphql(
  query,
  variables,
  operationLabel,
  {
    optionalField,
    optionalRootField,
    attempts = 3,
    timeoutMs = 20_000,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(graphqlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(graphqlRequestOrigin ? { Origin: graphqlRequestOrigin } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${operationLabel} failed with status ${response.status}`);

      const payload = await response.json();
      if (payload.errors?.length) {
        if (optionalRootField && hasOnlyMissingRootField(payload.errors, optionalRootField)) {
          return { data: payload.data || {} };
        }
        if (
          optionalField
          && hasOnlyMissingField(payload.errors, optionalField.fieldName, optionalField.typeName)
        ) {
          return { data: payload.data || {} };
        }
        throw new GraphqlResponseError(payload.errors);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
      }
    }
  }
  throw lastError;
}

async function discoverStaticGenerationConfig() {
  if (!graphqlEndpoint) return DEFAULT_STATIC_GENERATION_CONFIG;
  const payload = await requestGraphql(
    STATIC_GENERATION_CONFIG_QUERY,
    {},
    "WPGraphQL static-generation configuration",
    { optionalRootField: "funkycommerceStaticGenerationConfig", attempts: 1 },
  );
  const serialized = payload.data?.funkycommerceStaticGenerationConfig;
  if (serialized == null) return DEFAULT_STATIC_GENERATION_CONFIG;
  if (typeof serialized !== "string") throw new Error("WPGraphQL returned no static-generation configuration");
  const parsed = JSON.parse(serialized);
  return { ...DEFAULT_STATIC_GENERATION_CONFIG, ...parsed };
}

async function discoverStaticChrome() {
  if (!graphqlEndpoint) return DEFAULT_STATIC_CHROME;
  const payload = await requestGraphql(
    STATIC_CHROME_QUERY,
    { language: defaultLanguage },
    "storefront static chrome",
  );
  const storefrontConfig = payload.data?.storefrontConfig;
  const branding = storefrontConfig?.branding;
  const layout = storefrontConfig?.layout;
  const themeStyles = payload.data?.themeStyles;
  const colors = themeStyles?.colors;
  let decoration = null;
  let headerControls = null;
  let headerAssistant = null;
  let footerCredit = null;
  let layoutVariants = null;
  let recentOrders = null;
  let paymentGateways = null;
  try {
    decoration = await requestGraphql(
      STATIC_CHROME_DECORATION_QUERY,
      { language: defaultLanguage },
      "storefront static chrome decoration",
    );
  } catch (error) {
    console.warn(
      `Static navigation decoration unavailable; preserving style-critical chrome: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    paymentGateways = await requestGraphql(
      STATIC_PAYMENT_GATEWAYS_QUERY,
      {},
      "storefront payment gateways",
      { attempts: 1 },
    );
  } catch (error) {
    console.warn(
      `Payment gateways unavailable for prerender caching; checkout will refresh them at runtime: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    headerControls = await requestGraphql(
      STATIC_HEADER_CONTROLS_QUERY,
      { language: defaultLanguage },
      "storefront static header controls",
    );
  } catch (error) {
    console.warn(
      `Static header controls unavailable; using stable defaults: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    headerAssistant = await requestGraphql(
      STATIC_HEADER_ASSISTANT_QUERY,
      { language: defaultLanguage },
      "storefront static header assistant",
    );
  } catch (error) {
    console.warn(
      `Static header assistant unavailable; preserving stable controls: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    footerCredit = await requestGraphql(
      STATIC_FOOTER_CREDIT_QUERY,
      { language: defaultLanguage },
      "storefront static footer credit",
      { attempts: 1 },
    );
  } catch (error) {
    console.warn(
      `Static footer credit unavailable; using the required free-theme attribution: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    layoutVariants = await requestGraphql(
      STATIC_LAYOUT_VARIANTS_QUERY,
      { language: defaultLanguage },
      "storefront static layout variants",
      { attempts: 1 },
    );
  } catch (error) {
    console.warn(
      `Static layout variants unavailable; using stable header and footer layouts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    recentOrders = await requestGraphql(
      STATIC_RECENT_ORDERS_QUERY,
      { language: defaultLanguage },
      "storefront recent-order controls",
      { attempts: 1 },
    );
  } catch (error) {
    try {
      recentOrders = await requestGraphql(
        STATIC_RECENT_ORDERS_CADENCE_QUERY,
        { language: defaultLanguage },
        "storefront recent-order cadence controls",
        { attempts: 1 },
      );
      console.warn(
        `Recent-order link-target controls are unavailable on this backend; using the safe new-tab default: ${error instanceof Error ? error.message : String(error)}`,
      );
    } catch (cadenceError) {
      try {
        recentOrders = await requestGraphql(
          STATIC_RECENT_ORDERS_LEGACY_QUERY,
          { language: defaultLanguage },
          "legacy storefront recent-order controls",
          { attempts: 1 },
        );
        console.warn(
          `Recent-order quiet-time controls are unavailable on this backend; using the default quiet interval: ${cadenceError instanceof Error ? cadenceError.message : String(cadenceError)}`,
        );
      } catch (legacyError) {
        console.warn(
          `Recent-order controls unavailable; keeping notifications disabled: ${legacyError instanceof Error ? legacyError.message : String(legacyError)}`,
        );
      }
    }
  }
  const decorationBranding = decoration?.data?.storefrontConfig?.branding;
  const decorationLayout = decoration?.data?.storefrontConfig?.layout;
  const controls = headerControls?.data?.storefrontConfig;
  const assistantControls = headerAssistant?.data?.storefrontConfig;
  const assistantConfig = assistantControls?.aiAssistant;
  const footerCreditConfig = footerCredit?.data?.storefrontConfig?.footer;
  const layoutVariantConfig = layoutVariants?.data?.storefrontConfig?.layout;
  const recentOrdersConfig = recentOrders?.data?.storefrontConfig?.recentOrders;
  const gatewayNodes = paymentGateways?.data?.paymentGateways?.nodes;
  const cryptoAssets = paymentGateways?.data?.storefrontConfig?.cryptoAssets;
  const blikEnabled = paymentGateways?.data?.storefrontConfig?.payments?.blikEnabled === true;
  const controlFeatures = controls?.features;
  const controlLayout = controls?.layout;
  const baseCurrency = typeof controls?.baseCurrency === "string" && controls.baseCurrency.trim()
    ? controls.baseCurrency.trim().toUpperCase()
    : DEFAULT_STATIC_HEADER_CONTROLS.baseCurrency;
  const selectedCurrency = Array.isArray(controls?.currencies)
    ? controls.currencies.find((currency) => currency?.code?.toUpperCase() === baseCurrency)
    : null;
  const menus = Array.isArray(decoration?.data?.menus?.nodes) ? decoration.data.menus.nodes : [];
  const headerMenu = staticHeaderMenu(menus, defaultLanguage);
  return {
    storeName: typeof branding?.storeName === "string" && branding.storeName.trim()
      ? branding.storeName.trim()
      : DEFAULT_STATIC_CHROME.storeName,
    tagline: typeof branding?.tagline === "string" && branding.tagline.trim()
      ? branding.tagline.trim()
      : DEFAULT_STATIC_CHROME.tagline,
    logoUrl: safeStaticMediaUrl(branding?.logoUrl),
    iconUrl: safeStaticMediaUrl(decorationBranding?.iconUrl),
    promoHtml: sanitizeCmsHtml(decorationBranding?.promoHtml || ""),
    showAnnouncementBar: decorationLayout?.showAnnouncementBar === true,
    announcementBarScrollEffect: decorationLayout?.announcementBarScrollEffect !== false,
    showBreadcrumbs: decorationLayout?.showBreadcrumbs !== false,
    navigationMenus: menus,
    navigationItems: staticNavigationItems(headerMenu?.menuItems?.nodes),
    brandPalette: typeof layout?.brandPalette === "string"
      ? layout.brandPalette
      : DEFAULT_STATIC_CHROME.brandPalette,
    brandGradientStyle: layout?.brandGradientStyle === "flat" ? "flat" : "gradient",
    themeMaxWidthPx: Number.isInteger(layout?.themeMaxWidthPx)
      && layout.themeMaxWidthPx >= 960
      && layout.themeMaxWidthPx <= 1920
      ? layout.themeMaxWidthPx
      : DEFAULT_STATIC_CHROME.themeMaxWidthPx,
    headerArrangement: ["classic", "single-row", "centered", "island"].includes(layoutVariantConfig?.headerArrangement)
      ? layoutVariantConfig.headerArrangement
      : DEFAULT_STATIC_CHROME.headerArrangement,
    footerColumnsLayout: ["grid-1", "grid-2-wide", "grid-3", "grid-4", "grid-5", "grid-6", "grid-7", "accordion-single"].includes(layoutVariantConfig?.footerColumnsLayout)
      ? layoutVariantConfig.footerColumnsLayout
      : DEFAULT_STATIC_CHROME.footerColumnsLayout,
    recentOrders: {
      enabled: recentOrdersConfig?.enabled === true,
      itemCount: Math.max(1, Math.min(10, Number(recentOrdersConfig?.itemCount) || 5)),
      intervalSeconds: Math.max(3, Math.min(300, Number(recentOrdersConfig?.intervalSeconds) || 10)),
      quietSeconds: Math.max(2, Math.min(300, Number(recentOrdersConfig?.quietSeconds) || 8)),
      openLinksInNewTab: recentOrdersConfig?.openLinksInNewTab !== false,
    },
    paymentGatewayCache: {
      gateways: Array.isArray(gatewayNodes) ? gatewayNodes : [],
      blikEnabled,
      cryptoAssets: Array.isArray(cryptoAssets) ? cryptoAssets : [],
    },
    customCss: boundedStaticCss(themeStyles?.customCss, "WordPress custom CSS", 256_000),
    fontFaceStyles: boundedStaticCss(themeStyles?.fontFaceStyles, "WordPress font-face CSS", 128_000),
    globalStyles: boundedStaticCss(themeStyles?.globalStyles, "WordPress global CSS", 512_000),
    stylesheets: Array.isArray(themeStyles?.stylesheets) ? themeStyles.stylesheets : [],
    colors: Array.isArray(colors) ? colors : [],
    headerControls: {
      baseCurrency,
      currencySymbol: typeof selectedCurrency?.symbol === "string" && selectedCurrency.symbol.trim()
        ? selectedCurrency.symbol.trim()
        : baseCurrency,
      features: { ...DEFAULT_STATIC_HEADER_CONTROLS.features, ...controlFeatures },
      layout: { ...DEFAULT_STATIC_HEADER_CONTROLS.layout, ...controlLayout },
      assistant: {
        enabled: assistantConfig?.enabled === true,
        showHeader: assistantConfig?.showHeader === true || assistantConfig?.placement === "header",
        showFixed: assistantConfig?.showFixed === true || assistantConfig?.placement === "fixed",
        launcherLabel: DEFAULT_STATIC_HEADER_CONTROLS.assistant.launcherLabel,
      },
      icons: {
        ...DEFAULT_STATIC_HEADER_CONTROLS.icons,
        ...controls?.headerIcons,
        ...assistantControls?.headerIcons,
      },
      media: {
        ...DEFAULT_STATIC_HEADER_CONTROLS.media,
        ...controls?.headerIconMedia,
        ...assistantControls?.headerIconMedia,
      },
    },
    themeCredit: sanitizeCmsHtml(
      typeof footerCreditConfig?.themeCredit === "string" && footerCreditConfig.themeCredit.trim()
        ? footerCreditConfig.themeCredit
        : DEFAULT_STATIC_CHROME.themeCredit,
    ),
    showThemeCredit: footerCreditConfig?.showThemeCredit !== false,
  };
}

async function discoverLanguages() {
  if (!graphqlEndpoint) {
    backendLanguageFieldsAvailable = false;
    return [];
  }
  let payload;
  try {
    payload = await requestGraphql(
      LANGUAGES_QUERY,
      {},
      "WPGraphQL languages",
      { optionalRootField: "languages", attempts: expectedLanguages.length ? 1 : 3 },
    );
  } catch (error) {
    if (expectedLanguages.length) {
      backendLanguageFieldsAvailable = false;
      console.warn(
        `[prerender] WPGraphQL language discovery failed; using the configured locale contract: ${expectedLanguages.join(", ")}.`,
      );
      return expectedLanguages.map((locale) => ({
        routeCode: locale,
        backendCode: locale.toUpperCase(),
      }));
    }
    try {
      const response = await fetch(new URL("/wp-json/pll/v1/languages", graphqlEndpoint));
      if (response.ok) {
        const restLanguages = await response.json();
        if (!Array.isArray(restLanguages)) {
          throw new Error("Polylang REST returned a non-array language payload");
        }
        const languages = restLanguages.flatMap((language) => {
          const routeCode = typeof language?.slug === "string" ? language.slug.trim().toLowerCase() : "";
          return routeCode
            ? [{
                routeCode,
                backendCode: routeCode.toUpperCase(),
                isDefault: language?.is_default === true,
              }]
            : [];
        });
        if (languages.length) {
          defaultLanguage = languages.find(({ isDefault }) => isDefault)?.routeCode || defaultLanguage;
          backendLanguageFieldsAvailable = false;
          console.warn("[prerender] WPGraphQL language discovery failed; using Polylang REST languages.");
          return languages;
        }
      } else if (response.status !== 404) {
        throw new Error(`Polylang REST language discovery failed with status ${response.status}`);
      }
    } catch (restError) {
      console.warn(
        `[prerender] Polylang REST language discovery failed: ${restError instanceof Error ? restError.message : String(restError)}`,
      );
    }
    throw error;
  }
  const languages = (payload.data?.languages || [])
    .flatMap(({ slug, code }) => {
      const routeCode = (slug || code || "").trim().toLowerCase();
      const backendCode = (code || "").trim().toUpperCase();
      return routeCode && backendCode ? [{ routeCode, backendCode }] : [];
    });
  const hasGraphqlLanguages = languages.length > 0;
  if (!languages.length) {
    const configPayload = await requestGraphql(
      STOREFRONT_CONFIG_LANGUAGES_QUERY,
      {},
      "storefront config languages",
      { optionalRootField: "funkycommerceStorefrontConfig", attempts: 1 },
    );
    for (const language of configPayload.data?.storefrontConfig?.languages || []) {
      const routeCode = typeof language?.code === "string" ? language.code.trim().toLowerCase() : "";
      if (routeCode) {
        languages.push({
          routeCode,
          backendCode: routeCode.toUpperCase(),
        });
      }
    }
  }
  try {
    const response = await fetch(new URL("/wp-json/pll/v1/languages", graphqlEndpoint), {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const restLanguages = await response.json();
      const defaultRouteCode = Array.isArray(restLanguages)
        ? restLanguages.find((language) => language?.is_default === true)?.slug?.trim().toLowerCase()
        : "";
      if (defaultRouteCode && languages.some(({ routeCode }) => routeCode === defaultRouteCode)) {
        defaultLanguage = defaultRouteCode;
        languages.sort(({ routeCode }) => routeCode === defaultRouteCode ? -1 : 1);
      }
    }
  } catch (error) {
    console.warn(
      `[prerender] Polylang default-language discovery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!hasGraphqlLanguages && languages[0]) {
    defaultLanguage = languages[0].routeCode;
  }
  backendLanguageFieldsAvailable = hasGraphqlLanguages;
  return languages;
}

async function discoverRouteSeoSupport() {
  if (!graphqlEndpoint) return false;
  const payload = await requestGraphql(
    ROUTE_SEO_SUPPORT_QUERY,
    {},
    "WPGraphQL route SEO support",
    { optionalField: { fieldName: "seo", typeName: "Post" }, attempts: 1 },
  );
  return Boolean(payload.data?.posts);
}

async function discoverPublicRobotsSupport() {
  if (!graphqlEndpoint) return false;
  const payload = await requestGraphql(
    PUBLIC_ROBOTS_SUPPORT_QUERY,
    {},
    "Storefront public robots support",
    { optionalField: { fieldName: "funkycommercePublicRobots", typeName: "Page" }, attempts: 1 },
  );
  return Boolean(payload.data?.pages);
}

async function discoverRouteNodes(query, connections, operationLabel) {
  const discoveredNodes = [];
  let readingSettings;
  const cursors = Object.fromEntries(connections.map(({ cursorName }) => [cursorName, null]));
  const complete = Object.fromEntries(connections.map(({ responseName }) => [responseName, false]));

  while (!Object.values(complete).every(Boolean)) {
    const payload = await requestGraphql(
      query,
      cursors,
      operationLabel,
      { attempts: 5, timeoutMs: 60_000 },
    );
    readingSettings ||= payload.data?.readingSettings;

    for (const { responseName, cursorName, routeConnectionName } of connections) {
      if (complete[responseName]) continue;
      const connection = payload.data?.[responseName];
      if (!connection) throw new Error(`${operationLabel} omitted ${responseName}`);

      for (const node of connection.nodes || []) {
        discoveredNodes.push({ node, connectionName: routeConnectionName });
      }

      const { hasNextPage, endCursor } = connection.pageInfo || {};
      if (typeof hasNextPage !== "boolean") {
        throw new Error(`${operationLabel} omitted pagination metadata for ${responseName}`);
      }
      if (hasNextPage && (!endCursor || endCursor === cursors[cursorName])) {
        throw new Error(`${operationLabel} returned an incomplete pagination cursor for ${responseName}`);
      }
      complete[responseName] = !hasNextPage;
      cursors[cursorName] = endCursor;
    }
  }

  return { discoveredNodes, readingSettings };
}

const CORE_ROUTE_CONNECTIONS = [
  { responseName: "pages", cursorName: "pageAfter", routeConnectionName: "contentNodes" },
  { responseName: "posts", cursorName: "postAfter", routeConnectionName: "contentNodes" },
  { responseName: "categories", cursorName: "categoryAfter", routeConnectionName: "terms" },
  { responseName: "tags", cursorName: "tagAfter", routeConnectionName: "terms" },
  { responseName: "users", cursorName: "userAfter", routeConnectionName: "users" },
];

async function discoverCoreRouteNodesIndividually({ multilingual, publicRobots, translations, seo }) {
  const discoveredNodes = [];
  let readingSettings;
  for (const connection of CORE_ROUTE_CONNECTIONS) {
    const result = await discoverRouteNodes(
      buildCoreRoutesQuery({
        connections: [connection.responseName],
        multilingual,
        publicRobots,
        translations,
        seo,
      }),
      [connection],
      `WPGraphQL ${connection.responseName} route discovery`,
    );
    discoveredNodes.push(...result.discoveredNodes);
    readingSettings ||= result.readingSettings;
  }
  return { discoveredNodes, readingSettings };
}

async function discoverCmsRoutes({ publicRobotsSupported = false, seoSupported = false } = {}) {
  if (!graphqlEndpoint) return [];

  const multilingual = backendLanguageFieldsAvailable && configuredLanguageCodes.length > 0;
  const routeConnections = [
    { responseName: "contentNodes", cursorName: "contentAfter", routeConnectionName: "contentNodes" },
    { responseName: "terms", cursorName: "termAfter", routeConnectionName: "terms" },
    { responseName: "users", cursorName: "userAfter", routeConnectionName: "users" },
  ];
  let discovery;
  try {
    discovery = await discoverRouteNodes(
      buildRoutesQuery({
        commerce: commerceRoutesAvailable,
        multilingual,
        publicRobots: publicRobotsSupported,
        translations: configuredLanguageCodes.length > 1,
        seo: seoSupported,
      }),
      routeConnections,
      "WPGraphQL route discovery",
    );
  } catch (error) {
    const commerceMetadataUnavailable = commerceRoutesAvailable && (
      (
        error instanceof GraphqlResponseError
        && hasOnlyUnknownTypes(error.errors, COMMERCE_ROUTE_TYPES)
      )
      || (
        !backendLanguageFieldsAvailable
        && error instanceof Error
        && /WPGraphQL route discovery failed with status 500/.test(error.message)
      )
    );
    if (commerceMetadataUnavailable) {
      const compatibilityReason = error instanceof GraphqlResponseError
        ? "WooGraphQL route types are unavailable"
        : "WooCommerce multilingual route metadata is unavailable";
      console.warn(
        `[prerender] ${compatibilityReason}; retrying route discovery without commerce metadata.`,
      );
      discovery = await discoverRouteNodes(
        buildRoutesQuery({
          commerce: false,
          multilingual,
          publicRobots: publicRobotsSupported,
          translations: configuredLanguageCodes.length > 1,
          seo: seoSupported,
        }),
        routeConnections,
        "WPGraphQL route discovery without commerce metadata",
      );
    } else if (
      commerceRoutesAvailable
      || backendProfile === "full"
    ) {
      throw error;
    } else {
      console.warn(
        `Generic route discovery unavailable for the ${backendProfile} profile; retrying standard free connections: ${error instanceof Error ? error.message : String(error)}`,
      );
      try {
        discovery = await discoverRouteNodes(
          buildCoreRoutesQuery({
            multilingual,
            publicRobots: publicRobotsSupported,
            translations: configuredLanguageCodes.length > 1,
            seo: seoSupported,
          }),
          CORE_ROUTE_CONNECTIONS,
          "WPGraphQL standard route discovery",
        );
      } catch (coreError) {
        if (
          !(coreError instanceof Error)
          || !/WPGraphQL standard route discovery failed with status 500/.test(coreError.message)
        ) {
          throw coreError;
        }
        console.warn(
          "[prerender] Combined core route discovery failed; retrying isolated WordPress connections.",
        );
        discovery = await discoverCoreRouteNodesIndividually({
          multilingual,
          publicRobots: publicRobotsSupported,
          translations: configuredLanguageCodes.length > 1,
          seo: seoSupported,
        });
      }
    }
  }

  const { discoveredNodes, readingSettings } = discovery;
  if (!readingSettings) throw new Error("WPGraphQL route discovery omitted readingSettings");
  const frontPageIds = new Set();
  if (readingSettings.showOnFront === "page") {
    if (!readingSettings.pageOnFront) {
      throw new Error("WordPress is configured for a static homepage without a pageOnFront");
    }
    const configuredFrontPage = discoveredNodes.find(
      ({ node, connectionName }) =>
        connectionName === "contentNodes"
        && node?.__typename === "Page"
        && node.databaseId === readingSettings.pageOnFront,
    )?.node;
    if (!configuredFrontPage) {
      throw new Error(`The configured static front page ${readingSettings.pageOnFront} was not discovered`);
    }
    frontPageIds.add(configuredFrontPage.databaseId);
    for (const translation of configuredFrontPage.translations || []) {
      if (translation?.databaseId) frontPageIds.add(translation.databaseId);
    }
  }

  return discoveredNodes.flatMap(({ node, connectionName }) => {
    const resolvedNode = node?.__typename === "Page"
      ? { ...node, isFrontPage: frontPageIds.has(node.databaseId) }
      : node;
    const route = cmsRouteFromNode(
      resolvedNode,
      connectionName,
      defaultLanguage,
      configuredLanguageCodes,
    );
    if (!route) return [];
    const isDefaultFrontPage = resolvedNode?.__typename === "Page"
      && resolvedNode.isFrontPage
      && route.lang === defaultLanguage;
    if (!isDefaultFrontPage) return [route];
    const prefixedAlias = normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes);
    return prefixedAlias === route.path
      ? [route]
      : [route, { ...route, path: prefixedAlias, canonical: route.canonical || route.path }];
  });
}

const svgIntrinsicSizeCache = new Map();

async function resolveSvgIntrinsicSize(source) {
  if (svgIntrinsicSizeCache.has(source)) return svgIntrinsicSizeCache.get(source);

  const pendingSize = (async () => {
    let mediaUrl;
    try {
      mediaUrl = new URL(source);
    } catch {
      return null;
    }
    if (!graphqlEndpoint || mediaUrl.origin !== new URL(graphqlEndpoint).origin) return null;

    const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`SVG metadata request failed with status ${response.status}: ${mediaUrl}`);
    if (!response.body) throw new Error(`SVG metadata response had no body: ${mediaUrl}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sourcePrefix = "";
    let bytesRead = 0;
    while (!sourcePrefix.match(/<svg\b[^>]*>/i)) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > 32_768) {
        await reader.cancel();
        throw new Error(`SVG metadata exceeded the 32 KB header limit: ${mediaUrl}`);
      }
      sourcePrefix += decoder.decode(value, { stream: true });
    }
    await reader.cancel();

    const svgTag = sourcePrefix.match(/<svg\b[^>]*>/i)?.[0];
    const viewBox = svgTag?.match(/\bviewBox=(["'])\s*[+-]?(?:\d*\.)?\d+\s+[+-]?(?:\d*\.)?\d+\s+((?:\d*\.)?\d+)\s+((?:\d*\.)?\d+)\s*\1/i);
    if (!viewBox) throw new Error(`SVG metadata has no valid viewBox: ${mediaUrl}`);
    const width = Number(viewBox[2]);
    const height = Number(viewBox[3]);
    if (!(width > 0 && height > 0)) throw new Error(`SVG metadata has invalid intrinsic dimensions: ${mediaUrl}`);
    return { width, height };
  })();

  svgIntrinsicSizeCache.set(source, pendingSize);
  return pendingSize;
}

async function optimizeStaticCmsHtml(html, { placeholders = false } = {}) {
  const normalizedHtml = addDefaultCmsIconDimensions(
    rewriteStaticProxiedMediaUrls(normalizeStaticShortcodes(html, { placeholders }))
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\2/gi, "")
      .replace(/\s+style\s*=\s*(["'])(.*?)\1/gi, (_source, _quote, value) => {
        const sanitized = sanitizeCmsStyleAttribute(decodeAttributeEntities(value));
        return sanitized ? ` style="${escapeAttribute(sanitized)}"` : "";
      })
      .replace(/<(\/?)main\b/gi, "<$1div"),
  );
  const svgSources = [...normalizedHtml.matchAll(/<img\b[^>]*\ssrc=(["'])([^"']+\.svg(?:[?#][^"']*)?)\1[^>]*>/gi)]
    .map((match) => match[2].trim());
  const svgSizes = new Map(await Promise.all(
    [...new Set(svgSources)].map(async (source) => [source, await resolveSvgIntrinsicSize(source)]),
  ));
  const priorityImageIndex = selectStaticPriorityImageIndex(normalizedHtml);
  let imageIndex = 0;

  const optimizedHtml = normalizedHtml
    .replace(/<img\b([^>]*)>/gi, (_match, attributes) => {
      const isPriority = imageIndex === priorityImageIndex;
      imageIndex += 1;
      const source = attributes.match(/\ssrc=(["'])(.*?)\1/i)?.[2]?.trim();
      if (!source) return "";
      const isSvg = /\.svg(?:[?#]|$)/i.test(source);
      const width = Number.parseFloat(attributes.match(/\swidth=(["'])(.*?)\1/i)?.[2] || "");
      const height = Number.parseFloat(attributes.match(/\sheight=(["'])(.*?)\1/i)?.[2] || "");
      const isSmallImage = width > 0 && height > 0 && width <= 128 && height <= 128;
      const optimizedSource = staticImageCdnUrl(source, isSmallImage ? width : isPriority ? 1280 : 1024);
      const existingSizes = attributes.match(/\ssizes=(["'])(.*?)\1/i)?.[2]?.trim();
      let optimized = attributes
        .replace(/\s*\/\s*$/, "")
        .replace(/\sloading=(["']).*?\1/gi, "")
        .replace(/\sfetchpriority=(["']).*?\1/gi, "")
        .replace(/\ssrc=(["'])(.*?)\1/i, ` src="${optimizedSource}"`);
      if (optimizedSource !== source) {
        optimized = optimized
          .replace(/\ssrcset=(["'])(.*?)\1/gi, "")
          .replace(/\ssizes=(["'])(.*?)\1/gi, "");
        if (!isSmallImage) {
          optimized += ` srcset="${escapeAttribute(staticImageCdnSrcSet(source))}" sizes="${escapeAttribute(existingSizes || "100vw")}"`;
        }

        optimized += ` data-prerender-fallback-src="${escapeAttribute(source)}"`;
      }
      if (!/\salt=(["']).*?\1/i.test(optimized)) optimized += ' alt=""';
      if (!/\sdecoding=(["']).*?\1/i.test(optimized)) optimized += ' decoding="async"';
      const intrinsicSize = isSvg ? svgSizes.get(source) : null;
      if (intrinsicSize && !/\swidth=(["']).*?\1/i.test(optimized)) optimized += ` width="${intrinsicSize.width}"`;
      if (intrinsicSize && !/\sheight=(["']).*?\1/i.test(optimized)) optimized += ` height="${intrinsicSize.height}"`;
      if (isPriority) {
        optimized = optimized.replace(/\sdecoding=(["']).*?\1/gi, "");
        optimized += ' loading="eager" fetchpriority="high" decoding="sync"';
      } else {
        optimized = optimized
          .replace(/\ssrcset=(["'])(.*?)\1/gi, ' data-prerender-srcset=$1$2$1')
          .replace(/\ssrc=(["'])(.*?)\1/gi, ' data-prerender-src=$1$2$1');
        optimized += ' loading="lazy"';
      }

      return `<img${optimized}>`;
    });
  return optimizedHtml.replace(
    /(<section\b[^>]*\bclass=(["'])[^"']*\bshortcode-prerender-hero\b[^"']*\2[^>]*\bdata-prerender-min-height=(["']))([^"']+)(\3[^>]*)(>)/gi,
    (source, prefix, _classQuote, _heightQuote, height, suffix, close) => (
      safeStaticCssLength(height)
        ? `${prefix}${height}${suffix} style="min-height:${height}"${close}`
        : source
    ),
  );
}

function rewriteStaticProxiedMediaUrls(html) {
  if (!graphqlEndpoint) return html;
  const backendOrigin = new URL(graphqlEndpoint).origin;
  return html.replace(/\s(href|src)=(["'])(.*?)\2/gi, (attribute, name, quote, encodedUrl) => {
    const storefrontUrl = storefrontProxiedMediaUrl(decodeAttributeEntities(encodedUrl), {
      backendOrigin,
      baseUrl: backendOrigin,
    });
    const opaqueUrl = storefrontUrl ? registerPublicMediaProxyRoute(storefrontUrl, backendOrigin) : null;
    return storefrontUrl
      ? ` ${name}=${quote}${escapeAttribute(opaqueUrl)}${quote}`
      : attribute;
  });
}

function registerPublicMediaProxyRoute(storefrontUrl, backendOrigin) {
  const mediaUrl = new URL(storefrontUrl, backendOrigin);
  const integrity = createHash("sha256").update(mediaUrl.pathname).digest("hex");
  const filename = mediaUrl.pathname.split("/").pop() || "media";
  const publicPath = `/media/${integrity}/${filename}`;
  const existingTarget = publicMediaProxyRoutes.get(publicPath);
  const target = `${backendOrigin}${mediaUrl.pathname}`;
  if (existingTarget && existingTarget !== target) {
    throw new Error(`Public media integrity collision for ${publicPath}`);
  }
  publicMediaProxyRoutes.set(publicPath, target);
  return `${publicPath}${mediaUrl.search}${mediaUrl.hash}`;
}

function selectStaticPriorityImageIndex(html) {
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  let fallbackIndex = -1;
  for (const [index, match] of images.entries()) {
    const attributes = match[1];
    const source = attributes.match(/\ssrc=(["'])(.*?)\1/i)?.[2]?.trim();
    if (!source) continue;
    if (fallbackIndex === -1) fallbackIndex = index;
    const width = Number.parseFloat(attributes.match(/\swidth=(["'])(.*?)\1/i)?.[2] || "");
    const height = Number.parseFloat(attributes.match(/\sheight=(["'])(.*?)\1/i)?.[2] || "");
    const isSmall = width > 0 && height > 0 && width <= 128 && height <= 128;
    if (!/\.svg(?:[?#]|$)/i.test(source) && !isSmall) return index;
  }
  return fallbackIndex;
}

function staticImageCdnUrl(source, width) {
  const isProductionBuild = process.env.CONTEXT === "production"
    || process.env.CMS_STATIC_GENERATION_REQUIRED === "true"
    || process.env.NETLIFY === "true";
  if (!isProductionBuild) return source;
  try {
    const mediaUrl = new URL(source);
    const isWordPressUpload = /^(?:v[0-9]+|dev|blog|shop|sample)\.superfunky\.pro$/i.test(mediaUrl.hostname)
      && mediaUrl.pathname.startsWith("/wp-content/uploads/")
      && /\.(?:avif|jpe?g|png|webp)$/i.test(mediaUrl.pathname);
    const isUnsplashImage = mediaUrl.hostname === "images.unsplash.com"
      && /^\/photo-[a-z0-9-]+$/i.test(mediaUrl.pathname);
    if (!isWordPressUpload && !isUnsplashImage) return source;
    const parameters = new URLSearchParams({
      url: mediaUrl.toString(),
      w: String(Math.max(1, Math.min(1920, Math.round(width)))),
      q: "75",
    });
    return `/.netlify/images?${parameters.toString()}`;
  } catch {
    return source;
  }
}

function staticImageCdnSrcSet(source) {
  return [480, 768, 1024, 1280, 1600]
    .map((width) => `${staticImageCdnUrl(source, width)} ${width}w`)
    .join(", ");
}

async function discoverCommunityRoutes() {
  if (!graphqlEndpoint) return [];

  const discovered = [];
  const memberPayload = await requestGraphql(
    COMMUNITY_BUILD_MEMBERS_QUERY,
    {},
    "WPGraphQL community member route discovery",
  );
  if (!Array.isArray(memberPayload.data?.communityMembers)) {
    throw new Error("WPGraphQL community route discovery omitted communityMembers");
  }
  const eligibleMembers = memberPayload.data.communityMembers.filter((member) => {
    const handle = typeof member?.communityHandle === "string"
      ? member.communityHandle.trim()
      : "";
    return member?.communityProfilePublic === true
      && ["creator", "collaborator"].includes(member.communityRole)
      && Boolean(handle)
      && !handle.includes("/");
  });
  const eligibleMemberIds = new Set(eligibleMembers.map(({ databaseId }) => databaseId));
  const languages = configuredLanguages.length
    ? configuredLanguages
    : [{ routeCode: defaultLanguage, backendCode: defaultLanguage.toUpperCase() }];

  for (const { routeCode, backendCode } of languages) {
    for (const member of eligibleMembers) {
      const handle = member.communityHandle.trim();
      discovered.push({
        path: normalizeLanguageRoutePath(
          `/community/${encodeURIComponent(handle)}`,
          routeCode,
          configuredLanguageCodes,
        ),
        lang: routeCode,
        title: `${member.name?.trim() || `@${handle}`} | FunkyCommerce`,
        description: "View this community creator profile on FunkyCommerce.",
        source: "cms",
        type: "CommunityAuthor",
        indexable: true,
      });
    }

    if (!eligibleMemberIds.size) continue;

    const tags = new Map();
    let after = null;
    do {
      const payload = await requestGraphql(
        backendLanguageFieldsAvailable ? COMMUNITY_BUILD_POSTS_QUERY : COMPATIBLE_COMMUNITY_BUILD_POSTS_QUERY,
        backendLanguageFieldsAvailable ? { after, language: backendCode } : { after },
        `WPGraphQL ${routeCode} community tag route discovery`,
      );
      const posts = payload.data?.communityPosts;
      if (!posts) throw new Error("WPGraphQL community route discovery omitted communityPosts");

      for (const post of posts.nodes || []) {
        if (!eligibleMemberIds.has(post?.author?.node?.databaseId)) continue;
        for (const tag of post.communityTags?.nodes || []) {
          const slug = typeof tag?.slug === "string" ? tag.slug.trim() : "";
          const name = typeof tag?.name === "string" ? tag.name.trim() : "";
          if (!slug || !name || slug.includes("/")) continue;
          tags.set(slug, name);
        }
      }

      if (!posts.pageInfo.hasNextPage) break;
      if (!posts.pageInfo.endCursor) {
        throw new Error("WPGraphQL community route discovery returned an incomplete pagination cursor");
      }
      after = posts.pageInfo.endCursor;
    } while (after);

    for (const [slug, name] of tags) {
      discovered.push({
        path: normalizeLanguageRoutePath(
          `/community-tag/${encodeURIComponent(slug)}`,
          routeCode,
          configuredLanguageCodes,
        ),
        lang: routeCode,
        title: `#${name} | FunkyCommerce`,
        description: `Browse published community posts tagged #${name}.`,
        source: "cms",
        type: "CommunityTag",
        indexable: true,
      });
    }
  }
  return discovered;
}

async function renderRoute(route) {
  const completeCmsSnapshot = route.type === "Page" && route.cmsContent
    ? await optimizeStaticCmsHtml(route.cmsContent, { placeholders: true })
    : "";
  const generatedRouteSnapshot = !completeCmsSnapshot && route.source === "cms"
    ? await optimizeStaticCmsHtml(renderGeneratedRouteSnapshot(route), { placeholders: true })
    : "";
  const routeSnapshot = completeCmsSnapshot || generatedRouteSnapshot;
  // Extract the actual LCP image from the rendered snapshot — the image that already has
  // fetchpriority="high" set by optimizeStaticCmsHtml / selectStaticPriorityImageIndex.
  // The priority image keeps its optimized src, so the preload link can match the
  // rendered <img> exactly.
  const lcpImgMatch = routeSnapshot.match(/<img\b([^>]*\bfetchpriority=(["'])high\2[^>]*)>/i);
  const lcpImgAttrs = lcpImgMatch?.[1] ?? "";
  const heroImageRaw =
    lcpImgAttrs.match(/\bsrc=(["'])([^"']+)\1/i)?.[2]?.trim() ?? "";
  const heroSrcSet = decodeAttributeEntities(
    lcpImgAttrs.match(/\bsrcset=(["'])([^"']+)\1/i)?.[2]?.trim() ?? "",
  );
  const heroSizes = decodeAttributeEntities(
    lcpImgAttrs.match(/\bsizes=(["'])([^"']+)\1/i)?.[2]?.trim() ?? "",
  );
  const heroImage = heroImageRaw;
  const optimizedHeroImage = heroImage;
  const heroImageSrcSet = heroSrcSet && heroSizes
    ? ` imagesrcset="${escapeAttribute(heroSrcSet)}" imagesizes="${escapeAttribute(heroSizes)}"`
    : heroSrcSet
      ? ` imagesrcset="${escapeAttribute(heroSrcSet)}" imagesizes="100vw"`
      : "";
  const heroPreload = heroImage
    ? `\n    <link rel="preload" as="image" href="${escapeAttribute(optimizedHeroImage)}"${heroImageSrcSet} fetchpriority="high" />`
    : "";
  const seoHead = renderSeoHead(route);
  const staticTheme = renderStaticThemeVariables(
    staticChromeConfig.colors,
    staticChromeConfig.brandPalette,
    staticChromeConfig.brandGradientStyle,
    staticChromeConfig.themeMaxWidthPx,
  );
  const hydrationAssetUrls = [
    ...staticHydrationUrlsForRoute(route, routeSnapshot),
    staticRouteRegistryAsset,
    ...staticPageHydrationUrlsForRoute(route),
  ].filter(Boolean);

  // Discover the WP stylesheet immediately while preserving its final cascade position.
  const earlyPreloadHints = [
    staticStyleAsset
      ? `<link rel="preload" as="style" href="${escapeAttribute(staticStyleAsset.href)}" />`
      : "",
    ...(staticStyleAsset?.preloadAssets || []).map(({ href, contentType }) =>
      `<link rel="preload" as="font" type="${escapeAttribute(contentType)}" href="${escapeAttribute(href)}" crossorigin />`
    ),
  ].filter(Boolean).join("\n    ");

  let rendered = template
    .replace(
      '<html lang="en">',
      `<html lang="${route.lang}"${hasInteractiveStaticChrome ? " data-storefront-flagship" : ""}>`,
    )
    .replace(/\s*<title(?:\s[^>]*)?>.*?<\/title>/, "")
    .replace(
      /\s*<meta name="description" content=".*?" \/>/,
      `\n    ${seoHead}${heroPreload}${earlyPreloadHints ? `\n    ${earlyPreloadHints}` : ""}`,
    );
  const staticHead = [
    staticStyleAsset
      ? `<link rel="stylesheet" href="${escapeAttribute(staticStyleAsset.href)}" data-wordpress-static-style-source="${escapeAttribute(staticStyleAsset.sourceHash)}" />`
      : "",
    staticTheme ? `<style data-storefront-static-theme>${staticTheme}</style>` : "",
    `<script type="application/json" id="storefront-static-layout">${serializeStaticLayoutSeed(staticChromeConfig)}</script>`,
    staticChromeConfig.paymentGatewayCache.gateways.length
      ? `<script type="application/json" id="storefront-payment-gateway-cache">${serializePaymentGatewaySeed(staticChromeConfig.paymentGatewayCache)}</script>`
      : "",
    hydrationAssetUrls.length
      ? `<script type="application/json" id="storefront-static-hydration-assets">${JSON.stringify(hydrationAssetUrls).replaceAll("<", "\\u003c")}</script>`
      : "",
  ].filter(Boolean);
  if (staticChromeConfig.iconUrl) {
    rendered = rendered.replace(/\s*<link\b[^>]*\brel=(["'])(?:icon|shortcut icon|apple-touch-icon)\1[^>]*>/gi, "");
    staticHead.push(
      `<link rel="icon" href="${escapeAttribute(staticChromeConfig.iconUrl)}">`,
      `<link rel="apple-touch-icon" href="${escapeAttribute(staticChromeConfig.iconUrl)}">`,
    );
  }
  if (staticHead.length) {
    rendered = rendered.replace("</head>", `    ${staticHead.join("\n    ")}\n  </head>`);
  }
  if (!staticGenerationConfig.sitemapEnabled) {
    rendered = rendered.replace(/\s*<link rel="sitemap"[^>]*\/>/, "");
  }
  if (routeSnapshot) {
    const staticChrome = renderStaticChrome(route);
    const staticFooter = renderStaticFooter(route);
    const homePath = route.lang === defaultLanguage
      ? "/"
      : normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes);
    const homeLabel = route.lang === "pl" ? "Start" : route.lang === "ja" ? "ホーム" : "Home";
    const staticBreadcrumbs = renderStaticBreadcrumbs(route, homePath, homeLabel);
    const staticHeaderLayout = staticChromeConfig.showAnnouncementBar && staticChromeConfig.promoHtml
      ? "announcement"
      : "standard";
    const prerenderActivationMode = routeSnapshot.includes('data-prerender-video-poster="false"')
      ? "interaction"
      : "idle";
    rendered = stripBootstrapOverlay(
      rendered.replace(
        '<div id="root"></div>',
        `<div id="root"><div data-prerendered-chrome data-static-header-layout="${staticHeaderLayout}" data-recent-orders-enabled="${staticChromeConfig.recentOrders.enabled ? "true" : "false"}" data-recent-orders-count="${staticChromeConfig.recentOrders.itemCount}" data-recent-orders-interval="${staticChromeConfig.recentOrders.intervalSeconds}" data-recent-orders-quiet="${staticChromeConfig.recentOrders.quietSeconds}" data-recent-orders-new-tab="${staticChromeConfig.recentOrders.openLinksInNewTab ? "true" : "false"}">${staticChrome}<main id="prerendered-storefront" aria-label="Storefront content" data-prerender-activation="${prerenderActivationMode}">${staticBreadcrumbs}<section aria-label="${escapeAttribute(route.title)} content" data-cms-page${generatedRouteSnapshot ? " data-prerendered-cms-snapshot" : ""}><div class="wp-site-blocks entry-content is-layout-flow">${routeSnapshot}</div></section></main>${staticFooter}${renderStaticFloatingControls(route)}</div></div>`,
      ),
    );
  }

  function renderGeneratedRouteSnapshot(route) {
    const title = route.title.replace(/\s+(?:[|»·-])\s+(?:FunkyCommerce|Superfunky).*$/i, "").trim() || route.title;
    const typeLabel = String(route.type || "Content")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b(?:archive|directory)\b/gi, "")
      .trim();
    const image = route.image?.url
      ? `<figure class="storefront-generated-route__media"><img src="${escapeAttribute(route.image.url)}" alt="${escapeAttribute(route.image.alt || "")}"${route.image.width ? ` width="${route.image.width}"` : ""}${route.image.height ? ` height="${route.image.height}"` : ""}></figure>`
      : "";
    return `<article class="storefront-generated-route" data-generated-route-snapshot data-route-type="${escapeAttribute(route.type || "Content")}">
      <header class="storefront-generated-route__header">
        <span class="storefront-generated-route__type">${escapeAttribute(typeLabel || "Content")}</span>
        <h1>${escapeAttribute(title)}</h1>
        ${route.description ? `<p>${escapeAttribute(route.description)}</p>` : ""}
      </header>
      ${image}
    </article>`;
  }
  return injectBuildScripts(rendered);
}

function renderStaticChrome(route) {
  const homePath = route.lang === defaultLanguage
    ? "/"
    : normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes);
  const logo = staticChromeConfig.logoUrl
    ? `<img src="${escapeAttribute(staticChromeConfig.logoUrl)}" alt="" width="40" height="40" />`
    : staticChromeConfig.iconUrl
      ? `<span class="storefront-static-brand-mark" aria-hidden="true"><img src="${escapeAttribute(staticChromeConfig.iconUrl)}" alt="" width="40" height="40" /></span>`
      : '<span class="storefront-static-brand-mark" aria-hidden="true"></span>';
  const homeLabel = route.lang === "pl" ? "Start" : route.lang === "ja" ? "ホーム" : "Home";
  const searchPlaceholder = route.lang === "pl"
    ? "Szukaj produktów, artykułów, osób i tagów…"
    : route.lang === "ja"
      ? "商品、記事、ユーザー、タグを検索…"
      : "Search products, stories, people, and tags…";
  const navigationLabel = route.lang === "pl"
    ? "Główna nawigacja"
    : route.lang === "ja"
      ? "メインナビゲーション"
      : "Primary navigation";
  const routeMenu = staticHeaderMenu(staticChromeConfig.navigationMenus, route.lang);
  const routeNavigationItems = staticNavigationItems(routeMenu?.menuItems?.nodes);
  const navigationItems = routeNavigationItems.length
    ? routeNavigationItems
    : staticChromeConfig.navigationItems.length
      ? staticChromeConfig.navigationItems
    : [{ label: homeLabel, href: homePath }];
  const navigation = navigationItems
    .map((item, index) => {
      const { label, href, children = [] } = item;
      const submenuId = `storefront-static-submenu-${index}`;
      const submenu = hasInteractiveStaticChrome && children.length
        ? renderStaticSubmenu(item, submenuId, route.path)
        : "";
      const toggle = children.length
        ? hasInteractiveStaticChrome
          ? `<button type="button" class="storefront-static-nav-toggle" data-static-submenu-toggle aria-haspopup="true" aria-expanded="false" aria-controls="${submenuId}" aria-label="Show ${escapeAttribute(label)} links">${staticHeaderIcon("chevron-down", "", "chevron")}</button>`
          : `<span class="storefront-static-nav-toggle">${staticHeaderIcon("chevron-down", "", "chevron")}</span>`
        : "";
      const isActive = staticNavItemMatchesRoute(item, route.path);
      const menuClasses = staticMenuClassNames(item.cssClasses);
      return `<span class="storefront-static-nav-item${isActive ? " is-active" : ""}${menuClasses ? ` ${menuClasses}` : ""}">
        <a ${staticMenuLinkAttributes(item, route.path)}>${escapeAttribute(label)}</a>
        ${toggle}
        ${submenu}
      </span>`;
    })
    .join("");
  const announcement = staticChromeConfig.showAnnouncementBar && staticChromeConfig.promoHtml
    ? `<div class="storefront-static-announcement"><div class="storefront-static-announcement-content">${staticChromeConfig.promoHtml}</div></div>`
    : "";
  const controls = renderStaticHeaderControls(route);
  const parityAttribute = hasInteractiveStaticChrome ? " data-static-react-parity" : "";
  const searchIcon = hasInteractiveStaticChrome ? staticHeaderIcon("search", "", "search") : "";
  const mobileNavigation = hasInteractiveStaticChrome
    ? renderStaticMobileNavigation(navigationItems, navigationLabel, route.path)
    : "";
  return `<header class="storefront-static-header storefront-static-header--${staticChromeConfig.headerArrangement}" data-static-announcement-scroll="${staticChromeConfig.announcementBarScrollEffect ? "true" : "false"}"${parityAttribute}>
    ${announcement}
    <div class="storefront-static-header-main">
      <div class="storefront-static-header-row">
        <a class="storefront-static-brand" href="${escapeAttribute(homePath)}">
          ${logo}
          <span><strong class="funky-brand-heading">${escapeAttribute(staticChromeConfig.storeName)}</strong><small>${escapeAttribute(staticChromeConfig.tagline)}</small></span>
        </a>
        <span class="storefront-static-search" aria-hidden="true">${searchIcon}<span>${searchPlaceholder}</span></span>
        ${controls}
      </div>
      <div class="storefront-static-header-nav-row">
        <nav aria-label="${navigationLabel}">${navigation}</nav>
      </div>
    </div>
  </header><div class="storefront-static-header-spacer" data-static-header-spacer aria-hidden="true"></div>${mobileNavigation}<script data-static-navigation-runtime>${staticNavigationRuntimeSource}</script>`;
}

function renderStaticSubmenu(item, submenuId, routePath) {
  const children = item.children || [];
  const megaMenu = getMegaMenuConfiguration(item.cssClasses, children.length);
  const panelClasses = [
    "storefront-static-submenu",
    megaMenu ? "storefront-static-submenu--mega" : "",
  ].filter(Boolean).join(" ");
  const style = megaMenu
    ? ` style="--storefront-static-menu-columns:${megaMenu.columns}"`
    : "";
  const content = megaMenu
    ? `<div class="storefront-static-submenu-grid">${children.map((child) =>
        renderStaticSubmenuEntry(child, routePath, true),
      ).join("")}</div>`
    : children.map((child) => renderStaticSubmenuEntry(child, routePath, false)).join("");
  return `<div id="${submenuId}" class="${panelClasses}" role="menu" aria-hidden="true"${megaMenu ? style : ""}>${content}</div>`;
}

function renderStaticSubmenuEntry(item, routePath, column) {
  const children = item.children || [];
  const description = item.description
    ? `<div class="storefront-static-menu-description">${sanitizeCmsHtml(item.description)}</div>`
    : "";
  const nested = children.length
    ? `<div class="storefront-static-submenu-children" role="group">${children
        .map((child) => renderStaticSubmenuEntry(child, routePath, false))
        .join("")}</div>`
    : "";
  return `<div class="storefront-static-submenu-entry${column ? " storefront-static-submenu-column" : ""}">
    <a ${staticMenuLinkAttributes(item, routePath, "menuitem")}>${escapeAttribute(item.label)}</a>
    ${description}
    ${nested}
  </div>`;
}

function renderStaticMobileNavigation(items, navigationLabel, routePath) {
  const content = items.map((item) => renderStaticMobileNavigationItem(item, routePath, 0)).join("");
  return `<div class="storefront-static-mobile-backdrop" data-static-mobile-backdrop hidden>
    <aside id="storefront-static-mobile-navigation" class="storefront-static-mobile-drawer" role="dialog" aria-modal="true" aria-label="${escapeAttribute(navigationLabel)}" tabindex="-1">
      <div class="storefront-static-mobile-heading">
        <strong>${escapeAttribute(navigationLabel)}</strong>
        <button type="button" class="storefront-static-mobile-close" data-static-mobile-close aria-label="Close menu">×</button>
      </div>
      <nav aria-label="${escapeAttribute(navigationLabel)}">${content}</nav>
    </aside>
  </div>`;
}

function renderStaticMobileNavigationItem(item, routePath, depth) {
  const children = item.children || [];
  const itemId = `storefront-static-mobile-${String(item.id || item.databaseId || item.label).replace(/[^a-z0-9_-]+/gi, "-")}`;
  const toggle = children.length
    ? `<button type="button" class="storefront-static-mobile-expand" data-static-mobile-expand aria-expanded="false" aria-controls="${escapeAttribute(itemId)}" aria-label="Show ${escapeAttribute(item.label)} links">${staticHeaderIcon("chevron-down", "", "chevron")}</button>`
    : "";
  const nested = children.length
    ? `<div id="${escapeAttribute(itemId)}" class="storefront-static-mobile-children" hidden>${children
         .map((child) => renderStaticMobileNavigationItem(child, routePath, depth + 1))
         .join("")}</div>`
    : "";
  return `<div class="storefront-static-mobile-item" style="--storefront-static-menu-depth:${depth}">
    <span><a ${staticMenuLinkAttributes(item, routePath)}>${escapeAttribute(item.label)}</a>${toggle}</span>
    ${nested}
  </div>`;
}

function staticMenuLinkAttributes(item, routePath, role = "") {
  const attributes = [];
  if (role) attributes.push(`role="${role}"`);
  attributes.push(`href="${escapeAttribute(item.href)}"`);
  if (item.title) attributes.push(`title="${escapeAttribute(item.title)}"`);
  if (item.target) attributes.push(`target="${escapeAttribute(item.target)}"`);
  const rel = item.linkRelationship
    || (item.target === "_blank" ? "noopener noreferrer" : "");
  if (rel) attributes.push(`rel="${escapeAttribute(rel)}"`);
  if (staticNavHrefMatchesRoute(item.href, routePath)) {
    attributes.push('class="is-active"');
    attributes.push('aria-current="page"');
  }
  return attributes.join(" ");
}

function staticNavItemMatchesRoute(item, routePath) {
  return staticNavHrefMatchesRoute(item.href, routePath)
    || (item.children || []).some((child) => staticNavItemMatchesRoute(child, routePath));
}

function staticMenuClassNames(cssClasses) {
  return (cssClasses || [])
    .filter((className) => /^[a-z0-9_-]+$/i.test(className))
    .map((className) => `menu-${className}`)
    .join(" ");
}

function renderStaticBreadcrumbs(route, homePath, homeLabel) {
  const isHome = route.path === "/"
    || route.path === normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes);
  if (!hasInteractiveStaticChrome || !staticChromeConfig.showBreadcrumbs || isHome) return "";
  const currentLabel = route.title.replace(/\s+(?:[|»·-])\s+(?:FunkyCommerce|Superfunky).*$/i, "").trim() || route.title;
  const breadcrumbItems = Array.isArray(route.breadcrumbs) && route.breadcrumbs.length > 1
    ? route.breadcrumbs.map((breadcrumb, index, items) => ({
        label: breadcrumb.name,
        href: index === items.length - 1 ? "" : safeStaticHref(breadcrumb.url),
      }))
    : [
        { label: homeLabel, href: homePath },
        { label: currentLabel, href: "" },
      ];
  return `<nav class="storefront-static-breadcrumbs" aria-label="Breadcrumb">
    ${breadcrumbItems.map((item, index) => {
      const separator = index ? '<span aria-hidden="true">/</span>' : "";
      const crumb = item.href
        ? `<a href="${escapeAttribute(item.href)}">${escapeAttribute(item.label)}</a>`
        : `<span aria-current="page">${escapeAttribute(item.label)}</span>`;
      return `${separator}${crumb}`;
    }).join("")}
  </nav>`;
}

function renderStaticFooter(route) {
  if (!hasInteractiveStaticChrome) return "";
  const routeMenu = staticFooterMenu(staticChromeConfig.navigationMenus, route.lang);
  const routeFooterItems = staticFooterItems(routeMenu?.menuItems?.nodes);
  const footerItems = routeFooterItems.length
    ? routeFooterItems
    : staticChromeConfig.navigationItems.slice(0, 4);
  if (!footerItems.length) {
    footerItems.push({
      id: "home",
      label: route.lang === "pl" ? "Start" : route.lang === "ja" ? "ホーム" : "Home",
      href: normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes),
      children: [],
    });
  }
  const columns = footerItems.map((item) => {
    const children = item.children || [];
    return `<div class="storefront-static-footer-column">
      <a class="storefront-static-footer-heading" ${staticMenuLinkAttributes(item, route.path)}>${escapeAttribute(item.label)}</a>
      ${children.length ? `<ul>${children.map((child) => renderStaticFooterLinkItem(child, route.path)).join("")}</ul>` : ""}
    </div>`;
  }).join("");
  return `<footer class="storefront-static-footer" aria-label="Footer links">
    <div class="storefront-static-footer-inner storefront-static-footer-inner--${staticChromeConfig.footerColumnsLayout}">${columns}</div>
    <div class="storefront-static-footer-meta">© ${new Date().getFullYear()} ${escapeAttribute(staticChromeConfig.storeName)}</div>
    ${staticChromeConfig.showThemeCredit && staticChromeConfig.themeCredit
      ? `<div class="storefront-static-footer-meta">${staticChromeConfig.themeCredit}</div>`
      : ""}
  </footer>`;
}

function renderStaticFooterLinkItem(item, routePath) {
  const children = item.children || [];
  const nested = children.length
    ? `<ul>${children.map((child) => renderStaticFooterLinkItem(child, routePath)).join("")}</ul>`
    : "";
  return `<li><a ${staticMenuLinkAttributes(item, routePath)}>${escapeAttribute(item.label)}</a>${nested}</li>`;
}

function staticNavHrefMatchesRoute(href, routePath) {
  try {
    const resolved = new URL(href, effectiveSiteUrl || "https://storefront.invalid");
    if (
      /^[a-z][a-z\d+.-]*:/i.test(href)
      && effectiveSiteUrl
      && resolved.origin !== new URL(effectiveSiteUrl).origin
    ) return false;
    const normalize = (value) => {
      const path = new URL(value, "https://storefront.invalid").pathname.replace(/\/+$/, "");
      return path || "/";
    };
    return normalize(resolved.href) === normalize(routePath);
  } catch {
    return false;
  }
}

const STATIC_HEADER_ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  bell: '<path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  "book-marked": '<path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  "shopping-cart": '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.7 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"/>',
  menu: '<path d="M4 12h16M4 6h16M4 18h16"/>',
  command: '<path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12Z"/>',
  "message-circle": '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  cookie: '<path d="M12 2a10 10 0 1 0 10 10c0-1.1-.9-2-2-2h-1a3 3 0 0 1-3-3V6a4 4 0 0 0-4-4Z"/><circle cx="8.5" cy="8.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="15.5" r=".5" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".5" fill="currentColor"/>',
};

function renderStaticHeaderControls(route) {
  const controls = staticChromeConfig.headerControls || DEFAULT_STATIC_HEADER_CONTROLS;
  const enabled = (layoutValue, featureValue = true) => layoutValue !== false && featureValue !== false;
  const languageCode = route.lang.toLowerCase();
  const languageFlag = { zh: "CN", ko: "KR", sv: "SE" }[languageCode] || languageCode.toUpperCase();
  const items = [];

  if (
    configuredLanguageCodes.length > 1
    && enabled(controls.layout.showHeaderLanguageSwitcher, controls.features.languages)
  ) {
    const content = `
      <img src="/icons/flags/${escapeAttribute(languageFlag)}.svg" alt="" width="20" height="14" />
      <b>${escapeAttribute(languageCode.toUpperCase())}</b>
      ${staticHeaderIcon("chevron-down", "", "chevron")}`;
    items.push(hasInteractiveStaticChrome
      ? `<button type="button" class="storefront-static-switcher storefront-static-switcher--language" aria-label="Language">${content}</button>`
      : `<span class="storefront-static-switcher storefront-static-switcher--language">${content}</span>`);
  }
  if (enabled(controls.layout.showHeaderCurrencySwitcher, controls.features.currencies)) {
    const content = `
      <span>${escapeAttribute(controls.currencySymbol)}</span>
      <b>${escapeAttribute(controls.baseCurrency)}</b>
      ${staticHeaderIcon("chevron-down", "", "chevron")}`;
    items.push(hasInteractiveStaticChrome
      ? `<button type="button" class="storefront-static-switcher" data-static-control="currency" data-storefront-activate aria-label="Currency">${content}</button>`
      : `<span class="storefront-static-switcher">${content}</span>`);
  }

  if (controls.assistant?.enabled === true && controls.assistant.showHeader === true) {
    items.push(staticHeaderControl("assistant", controls.icons.assistant, controls.media.assistant, "message-circle"));
  }
  items.push('<span class="storefront-static-control-divider storefront-static-desktop-control"></span>');
  if (controls.layout.showHeaderDarkModeToggle !== false) {
    items.push(staticHeaderControl("theme", controls.icons.theme, controls.media.theme, "moon"));
  }
  if (controls.features.push !== false) {
    items.push(staticHeaderControl("push", "bell", "", "bell", false, false, "", false));
  }
  if (enabled(controls.layout.showHeaderAccountLink, controls.features.account)) {
    items.push(staticHeaderControl("account", controls.icons.account, controls.media.account, "user", true, false, normalizeLanguageRoutePath("/account", route.lang, configuredLanguageCodes)));
  }
  if (enabled(controls.layout.showHeaderReadingListLink, controls.features.readingList)) {
    items.push(staticHeaderControl("reading-list", controls.icons.readingList, controls.media.readingList, "book-marked", true, false, normalizeLanguageRoutePath("/reading-list", route.lang, configuredLanguageCodes)));
  }
  if (enabled(controls.layout.showHeaderWishlistLink, controls.features.wishlist)) {
    items.push(staticHeaderControl("wishlist", controls.icons.wishlist, controls.media.wishlist, "heart", true, false, normalizeLanguageRoutePath("/wishlist", route.lang, configuredLanguageCodes)));
  }
  if (enabled(controls.layout.showHeaderCartIcon, controls.features.cart)) {
    items.push(staticHeaderControl("cart", controls.icons.cart, controls.media.cart, "shopping-cart"));
  }
  items.push(staticHeaderControl("menu", controls.icons.menu, controls.media.menu, "menu", false, true));

  const hidden = hasInteractiveStaticChrome ? "" : ' aria-hidden="true"';
  return `<span class="storefront-static-controls"${hidden}>${items.join("")}</span>`;
}

function renderStaticFloatingControls(route) {
  if (!hasInteractiveStaticChrome) return "";
  const controls = staticChromeConfig.headerControls || DEFAULT_STATIC_HEADER_CONTROLS;
  const assistant = controls.assistant?.enabled === true && controls.assistant.showFixed === true
    ? `<aside class="sf-ai-assistant-launcher fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3">
        <button type="button" class="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-white shadow-glow transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg pointer-events-auto translate-y-0 scale-100 opacity-100" data-static-control="assistant-fixed" data-storefront-control="assistant-fixed" data-storefront-activate aria-label="${escapeAttribute(controls.assistant.launcherLabel)}">
          ${staticHeaderIcon(controls.icons.assistant, controls.media.assistant, "command")}
        </button>
      </aside>`
    : "";
  const privacyPath = normalizeLanguageRoutePath("/privacy-policy", route.lang, configuredLanguageCodes);
  const cookieBanner = `<div data-static-cookie-banner role="region" aria-label="Cookie consent" class="sf-cookie-consent funky-cookie-consent-banner fixed inset-x-4 bottom-4 z-40 grid gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-soft-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-sm">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-soft">${staticHeaderIcon("cookie", "", "cookie")}</span>
        <div class="grid gap-1">
          <strong class="font-display text-base text-zinc-900 dark:text-zinc-100">Cookie consent</strong>
          <p class="m-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">${escapeAttribute(staticChromeConfig.storeName)} uses cookies for site functionality, analytics, and advertising. Learn more in our <a href="${escapeAttribute(privacyPath)}#cookies" class="font-medium text-brand-600 underline dark:text-brand-400">Cookies Policy</a>.</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button type="button" data-static-control="cookie-settings-banner" data-storefront-control="cookie-settings-banner" data-storefront-activate class="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Settings</button>
        <button type="button" data-static-control="cookie-accept-all" data-storefront-control="cookie-accept-all" data-storefront-activate class="rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-glow">Accept all</button>
      </div>
    </div>`;
  const cookieSettings = `<button type="button" data-static-cookie-settings data-static-control="cookie-settings" data-storefront-control="cookie-settings" data-storefront-activate aria-label="Cookie settings" title="Cookie settings" class="fixed bottom-5 left-5 z-40 h-11 w-11 place-items-center rounded-full bg-brand-gradient text-white shadow-glow">${staticHeaderIcon("cookie", "", "cookie")}</button>`;
  return `${assistant}${cookieBanner}${cookieSettings}`;
}

function staticHeaderControl(role, iconName, mediaUrl, fallback, desktopOnly = false, mobileOnly = false, href = "", actionable = true) {
  const classes = [
    "storefront-static-control",
    desktopOnly ? "storefront-static-desktop-control" : "",
    mobileOnly ? "storefront-static-mobile-control" : "",
  ].filter(Boolean).join(" ");
  if (!hasInteractiveStaticChrome) {
    return `<span class="${classes}" data-static-control="${escapeAttribute(role)}">${staticHeaderIcon(iconName, mediaUrl, fallback)}</span>`;
  }
  const attributes = `class="${classes}" data-static-control="${escapeAttribute(role)}" data-storefront-control="${escapeAttribute(role)}" aria-label="${escapeAttribute(role.replaceAll("-", " "))}"`;
  if (href) {
    return `<a ${attributes} href="${escapeAttribute(href)}">${staticHeaderIcon(iconName, mediaUrl, fallback)}</a>`;
  }
  if (!actionable) {
    return `<span class="${classes}" data-static-control="${escapeAttribute(role)}" aria-hidden="true">${staticHeaderIcon(iconName, mediaUrl, fallback)}</span>`;
  }
  if (role === "theme") {
    return `<button type="button" ${attributes} data-static-theme-toggle aria-pressed="false">${staticHeaderIcon(iconName, mediaUrl, fallback)}</button>`;
  }
  if (role === "menu") {
    return `<button type="button" ${attributes} data-static-mobile-toggle aria-expanded="false" aria-controls="storefront-static-mobile-navigation">${staticHeaderIcon(iconName, mediaUrl, fallback)}</button>`;
  }
  return `<button type="button" ${attributes} data-storefront-activate>${staticHeaderIcon(iconName, mediaUrl, fallback)}</button>`;
}

function staticHeaderIcon(iconName, mediaUrl, fallback) {
  const safeMediaUrl = safeStaticMediaUrl(mediaUrl);
  if (safeMediaUrl) {
    return `<img src="${escapeAttribute(safeMediaUrl)}" alt="" width="18" height="18" decoding="async" fetchpriority="high" />`;
  }
  const icon = STATIC_HEADER_ICON_PATHS[iconName] || STATIC_HEADER_ICON_PATHS[fallback];
  if (fallback === "chevron") {
    return '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
}

function staticNavigationItems(items) {
  if (!Array.isArray(items)) return [];
  return mapMenuItems(items, (value) => safeStaticHref(value)).slice(0, 12);
}

function staticHeaderMenu(menus, languageCode) {
  if (!Array.isArray(menus)) return null;
  return menus
    .map((menu, index) => ({
      menu,
      index,
      score: scoreStaticHeaderMenu(menu, languageCode),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .find(({ menu }) => Array.isArray(menu?.menuItems?.nodes) && menu.menuItems.nodes.length)
    ?.menu || null;
}

function staticFooterItems(items) {
  if (!Array.isArray(items)) return [];
  return mapMenuItems(items, (value) => safeStaticHref(value)).slice(0, 8);
}

function staticFooterMenu(menus, languageCode) {
  if (!Array.isArray(menus)) return null;
  return menus
    .map((menu, index) => ({
      menu,
      index,
      score: scoreStaticFooterMenu(menu, languageCode),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .find(({ menu }) => Array.isArray(menu?.menuItems?.nodes) && menu.menuItems.nodes.length)
    ?.menu || null;
}

function scoreStaticFooterMenu(menu, languageCode) {
  const assignedLocations = new Set([
    ...(menu?.locations || []),
    ...(menu?.menuItems?.nodes?.flatMap((item) => item?.locations || []) || []),
  ]);
  const language = String(languageCode || "").toUpperCase();
  const searchableName = `${menu?.name || ""} ${menu?.slug || ""}`.toUpperCase();
  if (assignedLocations.has(`FOOTER___${language}`)) return 130;
  if (assignedLocations.has("FOOTER")) return 120;
  if ([...assignedLocations].some((location) => location.startsWith("FOOTER___"))) return 110;
  if (searchableName.includes("FOOTER")) return 105;
  const hintScore = ["footer", "bottom", "legal", "links", "support", "help"]
    .reduce((score, hint) => score + (searchableName.includes(hint.toUpperCase()) ? 1 : 0), 0);
  if (hintScore) return 104 + hintScore;
  return 0;
}

function scoreStaticHeaderMenu(menu, languageCode) {
  const assignedLocations = new Set([
    ...(menu?.locations || []),
    ...(menu?.menuItems?.nodes?.flatMap((item) => item?.locations || []) || []),
  ]);
  const language = String(languageCode || "").toUpperCase();
  const searchableName = `${menu?.name || ""} ${menu?.slug || ""}`.toUpperCase();
  if (assignedLocations.has(`HEADER___${language}`)) return 130;
  if (assignedLocations.has("HEADER")) return 120;
  if ([...assignedLocations].some((location) => location.startsWith("HEADER___"))) return 110;
  if (searchableName.includes("HEADER")) return 105;
  const hintScore = ["header", "main", "primary", "desktop", "top", "navigation", "nav"]
    .reduce((score, hint) => score + (searchableName.includes(hint.toUpperCase()) ? 1 : 0), 0);
  if (hintScore) return 104 + hintScore;
  if (!assignedLocations.size) return 3 + (menu?.menuItems?.nodes?.length || 0);
  return 1;
}

function safeStaticHref(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const href = value.trim();
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (graphqlEndpoint && url.origin === new URL(graphqlEndpoint).origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return "";
  }
}

function staticText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function safeStaticCssLength(value) {
  return /^(?:\d+(?:\.\d+)?)(?:px|rem|vh|svh|dvh)$/i.test(value) ? value : "";
}

function safeStaticMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function boundedStaticCss(value, label, maxLength) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (Buffer.byteLength(value, "utf8") > maxLength) {
    throw new Error(`${label} exceeds the ${maxLength} byte build limit`);
  }
  return value;
}

function serializeStaticLayoutSeed(config) {
  return JSON.stringify({
    brandPalette: config.brandPalette,
    brandGradientStyle: config.brandGradientStyle,
    themeMaxWidthPx: config.themeMaxWidthPx,
  }).replaceAll("<", "\\u003c");
}

function serializePaymentGatewaySeed(cache) {
  return JSON.stringify(cache).replaceAll("<", "\\u003c");
}

async function buildStaticStyleAsset(styles) {
  if (!graphqlEndpoint) return null;
  const stylesheets = sanitizeWordPressStylesheetUrls(styles.stylesheets, graphqlEndpoint);
  const sourceHash = staticStyleSourceHash({
    fontFaceStyles: styles.fontFaceStyles,
    globalStyles: styles.globalStyles,
    stylesheets,
    customCss: styles.customCss,
  });
  const sections = [
    sanitizeWordPressFontFaces(styles.fontFaceStyles),
    sanitizeWordPressGlobalStyles(styles.globalStyles),
  ];
  for (const stylesheetUrl of stylesheets) {
    sections.push(await fetchStaticStylesheet(stylesheetUrl));
  }
  sections.push(
    styles.customCss,
    WORDPRESS_BLOCK_COMPATIBILITY_CSS,
    createWordPressElementTypographyCss(styles.globalStyles),
  );
  const sourceCss = sections.filter((section) => section.trim()).join("\n");
  if (!sourceCss) return null;
  if (Buffer.byteLength(sourceCss, "utf8") > 1_500_000) {
    throw new Error("Combined WordPress static CSS exceeds the 1.5 MB build limit");
  }
  const localized = await localizeStaticFontAssets(sourceCss, { outputDirectory });
  const css = localized.css;

  const contentHash = createHash("sha256").update(css).digest("hex").slice(0, 16);
  const filename = `wordpress-static-${contentHash}.css`;
  await mkdir(resolve(outputDirectory, "assets"), { recursive: true });
  await writeFile(resolve(outputDirectory, "assets", filename), `${css}\n`);
  return {
    href: `/assets/${filename}`,
    sourceHash,
    fontAssets: localized.fontAssets,
    preloadAssets: localized.preloadAssets,
  };
}

async function writeStaticHydrationAsset(label, entries, generatedAt) {
  if (!entries.length) return null;
  const payload = {
    schemaVersion: 1,
    shellVersion: process.env.STOREFRONT_ARTIFACT_SHELL_VERSION
      || process.env.COMMIT_REF
      || process.env.DEPLOY_ID
      || "static-build",
    contentRevision: 0,
    generatedAt,
    expiresAt: new Date(Date.parse(generatedAt) + STATIC_HYDRATION_TTL_MS).toISOString(),
    entries,
  };
  const serialized = JSON.stringify(payload);
  const contentHash = createHash("sha256").update(serialized).digest("hex").slice(0, 16);
  const filename = `storefront-hydration-${label}-${contentHash}.json`;
  await mkdir(resolve(outputDirectory, "assets"), { recursive: true });
  await writeFile(resolve(outputDirectory, "assets", filename), serialized);
  return `/assets/${filename}`;
}

async function stampServiceWorkerVersion(generatedAt) {
  const serviceWorkerPath = resolve(outputDirectory, "sw.js");
  const source = await readFile(serviceWorkerPath, "utf8");
  const token = "__FUNKYCOMMERCE_BUILD_VERSION__";
  if (!source.includes(token)) {
    throw new Error("Service worker build-version token is missing");
  }
  const deploymentVersion = process.env.COMMIT_REF
    || process.env.DEPLOY_ID
    || createHash("sha256").update(generatedAt).digest("hex").slice(0, 16);
  await writeFile(serviceWorkerPath, source.replaceAll(token, deploymentVersion));
}

async function writeStaticPageHydrationAsset(route, generatedAt) {
  const pageUri = route.path === "/" ? "/" : `${route.path.replace(/\/+$/, "")}/`;
  const configuredLanguageKey = configuredLanguageCodes.join(",");
  return writeStaticHydrationAsset(
    `page-${route.lang}-${route.cmsPage.databaseId}`,
    [
      {
        cacheKey: `page:${pageUri}`,
        value: route.cmsPage,
        dependencies: [`page:${route.cmsPage.databaseId}`, `translation:${route.lang}`],
      },
      {
        cacheKey: `content-page-by-uri:v1:${pageUri}`,
        value: route.cmsPage,
        dependencies: [`page:${route.cmsPage.databaseId}`, `translation:${route.lang}`],
      },
      {
        cacheKey: `content-node:v2:${pageUri}`,
        value: { type: "Page" },
        dependencies: [`page:${route.cmsPage.databaseId}`],
      },
      ...(route.cmsPage.isFrontPage || route.path === "/" || route.path === `/${route.lang}`
        ? [{
            cacheKey: `home-page:v1:${route.lang}:${configuredLanguageKey}`,
            value: route.cmsPage,
            dependencies: [`page:${route.cmsPage.databaseId}`, `translation:${route.lang}`],
          }]
        : []),
    ],
    generatedAt,
  );
}

async function buildStaticPageHydrationAssets(routes, generatedAt) {
  const assets = new Map();
  await Promise.all(routes.map(async (route) => {
    if (!route.cmsPage) return;
    const asset = await writeStaticPageHydrationAsset(route, generatedAt);
    if (asset) {
      assets.set(route.path, asset);
      assets.set(`id:${route.cmsPage.databaseId}`, asset);
    }
  }));
  return assets;
}

async function writeStaticRouteRegistryAsset(routes, generatedAt) {
  const entries = routes.flatMap((route) => {
    if (!route.cmsPage) return [];
    return classifyPageRouteKeys({
      uri: route.cmsPage.uri,
      slug: route.cmsPage.slug,
      language: { code: route.cmsPage.languageCode },
      isFrontPage: route.path === "/" || route.path === `/${route.lang}`,
      headlessShortcodes: route.cmsPage.headlessShortcodes,
    }).map((key) => ({
      key,
      uri: route.cmsPage.uri,
      languageCode: route.cmsPage.languageCode,
    }));
  });
  return writeStaticHydrationAsset(
    "route-registry",
    [{
      cacheKey: `storefront-route-registry:v6:${configuredLanguageCodes[0] || defaultLanguage}`,
      value: entries,
      dependencies: ["route:/", "translation:global"],
    }],
    generatedAt,
  );
}

async function loadStaticHydrationSeed(task, languageCode) {
  const attempts = task.name === "navigation" ? 3 : 2;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task.load();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(
          `[hydration] Retrying ${task.name} seed for ${languageCode} after attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`,
        );
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
      }
    }
  }
  throw lastError;
}

async function buildStaticHydrationAssets(languages, generatedAt) {
  if (!graphqlEndpoint) return new Map();
  const [
    { getAiAssistantConfiguration, getNavigationData },
    { getCommerceCatalog },
    { getBlogData, getBlogSummaryData },
    { getCommunityData, getCommunityFeedData },
  ] = await Promise.all([
    import("../src/lib/navigation.ts"),
    import("../src/lib/commerce.ts"),
    import("../src/lib/blog.ts"),
    import("../src/lib/community.ts"),
  ]);
  const assetsByLanguage = new Map();

  for (const language of languages) {
    const languageCode = language.routeCode.toLowerCase();
    const backendLanguageCode = language.backendCode || languageCode.toUpperCase();
    const tasks = [
      {
        name: "navigation",
        enabled: true,
        load: async () => {
          const [navigation, assistant] = await Promise.all([
            getNavigationData(languageCode),
            getAiAssistantConfiguration(languageCode),
          ]);
          return { assistant, navigation };
        },
        entries: ({ assistant, navigation }) => [
          {
            cacheKey: navigationDataCacheKey(languageCode),
            value: navigation,
            dependencies: ["config:storefront", "menu:global", `translation:${languageCode}`],
          },
          ...(assistant
            ? [{
                cacheKey: `navigation-assistant:v2:${languageCode}`,
                value: assistant,
                dependencies: ["config:storefront", `translation:${languageCode}`],
              }]
            : []),
        ],
      },
      {
        name: "commerce",
        enabled: commerceRoutesAvailable,
        load: () => getCommerceCatalog(languageCode, backendLanguageCode),
        entries: (value) => [{
          cacheKey: `commerce-data:v4:${languageCode}:${backendLanguageCode}`,
          value,
          dependencies: ["product:catalog", `translation:${languageCode}`],
        }],
      },
      {
        name: "blog",
        enabled: backendProfile === "blog" || backendProfile === "full",
        load: () => getBlogData(languageCode, backendLanguageCode),
        entries: (value) => [{
          cacheKey: `blog-data:v4:${languageCode}:${backendLanguageCode}`,
          value,
          dependencies: ["post:archive", `translation:${languageCode}`],
        }],
      },
      {
        name: "blogSummary",
        enabled: backendProfile === "blog" || backendProfile === "full",
        load: () => getBlogSummaryData(languageCode, backendLanguageCode),
        entries: (value) => [{
          cacheKey: `blog-data:summary:v1:${languageCode}:${backendLanguageCode}`,
          value,
          dependencies: ["post:archive", `translation:${languageCode}`],
        }],
      },
      {
        name: "community",
        enabled: backendProfile === "full",
        load: () => getCommunityData(languageCode, backendLanguageCode),
        entries: (value) => [{
          cacheKey: `community:v10:${languageCode}:${backendLanguageCode}:0:0`,
          value,
          dependencies: ["community:public", `translation:${languageCode}`],
        }],
      },
      {
        name: "communityFeed",
        enabled: backendProfile !== "shell",
        load: () => getCommunityFeedData(languageCode, backendLanguageCode),
        entries: (value) => [{
          cacheKey: `community:feed:v1:${languageCode}:${backendLanguageCode}:public:0`,
          value,
          dependencies: ["community:public", `translation:${languageCode}`],
        }],
      },
    ].filter(({ enabled }) => enabled);
    const [navigationTask, ...contentTasks] = tasks;
    const navigationResult = await loadStaticHydrationSeed(navigationTask, languageCode)
      .then((value) => ({ status: "fulfilled", value }))
      .catch((reason) => ({ status: "rejected", reason }));
    if (navigationResult.status === "fulfilled" && languageCode === defaultLanguage) {
      synchronizeStaticAssistantWithHydrationSeed(navigationResult.value);
    }
    const contentResults = await Promise.allSettled(
      contentTasks.map((task) => loadStaticHydrationSeed(task, languageCode)),
    );
    const results = [navigationResult, ...contentResults];
    const languageAssets = {};
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const task = tasks[index];
      if (result.status === "rejected") {
        console.warn(
          `[hydration] ${task.name} seed unavailable for ${languageCode}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
        continue;
      }
      languageAssets[task.name] = await writeStaticHydrationAsset(
        `${task.name}-${languageCode}`,
        task.entries(result.value),
        generatedAt,
      );
    }
    assetsByLanguage.set(languageCode, languageAssets);
  }
  return assetsByLanguage;
}

function synchronizeStaticAssistantWithHydrationSeed({ assistant, navigation }) {
  const configuration = navigation?.storefrontConfig;
  const assistantIcon = configuration?.headerIcons?.assistant;
  const assistantMedia = configuration?.headerIconMedia?.assistant;
  staticChromeConfig = {
    ...staticChromeConfig,
    headerControls: {
      ...staticChromeConfig.headerControls,
      assistant: {
        ...staticChromeConfig.headerControls.assistant,
        enabled: assistant?.enabled === true,
        showHeader: assistant?.showHeader === true || assistant?.placement === "header",
        showFixed: assistant?.showFixed === true || assistant?.placement === "fixed",
      },
      icons: {
        ...staticChromeConfig.headerControls.icons,
        ...(typeof assistantIcon === "string" && assistantIcon.trim()
          ? { assistant: assistantIcon.trim() }
          : {}),
      },
      media: {
        ...staticChromeConfig.headerControls.media,
        assistant: typeof assistantMedia === "string" ? assistantMedia.trim() : "",
      },
    },
  };
}

function staticHydrationUrlsForRoute(route, renderedMarkup) {
  const assets = staticHydrationAssets.get(route.lang.toLowerCase());
  if (!assets) return [];
  const localeAssets = [...staticHydrationAssets.values()];
  const requirements = resolveBackendDataRequirements(backendProfile, route.path, renderedMarkup);
  const urls = localeAssets.map(({ navigation }) => navigation);
  if (requirements.commerce) {
    urls.push(...localeAssets.map(({ commerce }) => commerce));
  }
  if (requirements.blog) {
    const summaryOnly = canUseHomepageBlogSummary(route.path, renderedMarkup);
    urls.push(...localeAssets.map((locale) => summaryOnly ? locale.blogSummary : locale.blog));
  }
  if (requirements.community) {
    const feedOnly = canUseHomepageCommunityFeed(route.path, renderedMarkup);
    urls.push(...localeAssets.map((locale) => feedOnly ? locale.communityFeed : locale.community));
  }
  return [...new Set(urls.filter(Boolean))];
}

function staticPageHydrationUrlsForRoute(route) {
  if (!route.cmsPage) return [];
  const translatedPaths = route.cmsPage.translations.map(({ uri }) => normalizedRoutePath(uri));
  const translatedIds = route.cmsPage.translations.map(({ databaseId }) => `id:${databaseId}`);
  return [...new Set(
    [route.path, ...translatedPaths, ...translatedIds]
      .map((path) => staticPageHydrationAssets.get(path))
      .filter(Boolean),
  )];
}

async function fetchStaticStylesheet(stylesheetUrl) {
  const response = await fetch(stylesheetUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`WordPress stylesheet request failed with status ${response.status}: ${stylesheetUrl}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/css(?:;|$)/i.test(contentType)) {
    throw new Error(`WordPress stylesheet returned ${contentType || "no content type"}: ${stylesheetUrl}`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 512_000) {
    throw new Error(`WordPress stylesheet exceeds the 512 KB build limit: ${stylesheetUrl}`);
  }
  const css = await response.text();
  if (Buffer.byteLength(css, "utf8") > 512_000) {
    throw new Error(`WordPress stylesheet exceeds the 512 KB build limit: ${stylesheetUrl}`);
  }
  if (/@import\b/i.test(css)) {
    throw new Error(`WordPress stylesheet contains an unsupported @import rule: ${stylesheetUrl}`);
  }
  return rewriteStaticStylesheetUrls(css, stylesheetUrl);
}

function rewriteStaticStylesheetUrls(css, stylesheetUrl) {
  return css.replace(/url\(\s*(["']?)([^"'()]+)\1\s*\)/gi, (match, _quote, value) => {
    const source = value.trim();
    if (!source || /^(?:data:|https?:|#)/i.test(source)) return match;
    try {
      const resolved = new URL(source, stylesheetUrl);
      return `url("${resolved.href.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`;
    } catch {
      throw new Error(`WordPress stylesheet contains an invalid resource URL: ${source}`);
    }
  });
}

function renderStaticThemeVariables(colors, brandPalette, brandGradientStyle, themeMaxWidthPx) {
  const findColor = (...slugs) => colors.find(({ slug }) => slugs.includes(slug))?.color;
  const background = parseStaticHexColor(findColor("background"));
  const foreground = parseStaticHexColor(findColor("foreground"));
  const declarations = brandPaletteCssVariables(brandPalette, brandGradientStyle);
  declarations.push(`--storefront-static-max-width:${themeMaxWidthPx}px`);
  if (background) declarations.push(`--theme-background:${background.join(" ")}`);
  if (foreground) declarations.push(`--theme-foreground:${foreground.join(" ")}`);
  return declarations.length ? `:root{${declarations.join(";")}}` : "";
}

function parseStaticHexColor(value) {
  const match = typeof value === "string" ? value.trim().match(/^#([\da-f]{6})$/i) : null;
  if (!match) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function injectBuildScripts(html) {
  const gtmId = /^GTM-[A-Z0-9]+$/.test(staticGenerationConfig.gtmContainerId)
    ? staticGenerationConfig.gtmContainerId
    : "";
  const gtmHead = gtmId
    ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`
    : "";
  const gtmBody = gtmId
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
    : "";
  const headContent = [gtmHead, staticGenerationConfig.headScripts].filter(Boolean).join("\n");
  const bodyContent = [gtmBody, staticGenerationConfig.bodyScripts].filter(Boolean).join("\n");
  const footerContent = staticGenerationConfig.footerScripts;
  return html
    .replace("</head>", `${headContent ? `    ${headContent}\n` : ""}  </head>`)
    .replace("<body>", `<body>${bodyContent ? `\n    ${bodyContent}` : ""}`)
    .replace("</body>", `${footerContent ? `    ${footerContent}\n` : ""}  </body>`);
}

async function writeControlledFile(path, enabled, content) {
  const target = resolve(outputDirectory, path);
  if (!enabled) {
    await rm(target, { force: true });
    return;
  }
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, content.endsWith("\n") ? content : `${content}\n`);
}

async function writeAppleMerchantFile(configuredContent) {
  const path = ".well-known/apple-developer-merchantid-domain-association";
  const target = resolve(outputDirectory, path);
  if (configuredContent.trim()) {
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, configuredContent);
    return true;
  }

  try {
    const existingContent = await readFile(target, "utf8");
    if (existingContent.trim()) return true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await rm(target, { force: true });
  return false;
}

function parseJsonSetting(value, fallback, label) {
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`${label} contained invalid JSON; using its safe fallback.`);
    return fallback;
  }
}

function renderRedirects(appleMerchantFileEnabled) {
  const rules = parseJsonSetting(staticGenerationConfig.redirectRules, [], "Frontend redirects");
  const renderedRules = Array.isArray(rules)
    ? rules.flatMap((rule) => {
        const from = typeof rule?.from === "string" ? rule.from.trim() : "";
        const to = typeof rule?.to === "string" ? rule.to.trim() : "";
        const status = [200, 301, 302, 307, 308].includes(Number(rule?.status)) ? Number(rule.status) : 301;
        if (!from.startsWith("/") || !to || /[\r\n\s]/.test(from) || /[\r\n\s]/.test(to)) return [];
        return [{ rendered: `${from}  ${to}  ${status}${rule.force ? "!" : ""}`, status }];
      })
    : [];
  const redirectRules = renderedRules.filter(({ status }) => status !== 200).map(({ rendered }) => rendered);
  const rewriteRules = renderedRules.filter(({ status }) => status === 200).map(({ rendered }) => rendered);
  const cmsRouteRedirects = routes.flatMap(({ path, redirectFrom }) =>
    redirectFrom && redirectFrom !== path ? [`${redirectFrom}  ${path}  301`] : []);
  const sitemapFallback = staticGenerationConfig.sitemapEnabled ? [] : ["/sitemap  /index.html  404"];
  const appleMerchantFallback = appleMerchantFileEnabled
    ? []
    : ["/.well-known/apple-developer-merchantid-domain-association  /index.html  404"];
  const mediaDocumentProxy = graphqlEndpoint
    ? [`/wp-content/uploads/*  ${new URL(graphqlEndpoint).origin}/wp-content/uploads/:splat  200`]
    : [];
  const opaqueMediaProxy = [...publicMediaProxyRoutes]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([publicPath, target]) => `${publicPath}  ${target}  200!`);
  return [
    "/product.feed.xml  /product-feed.xml  301",
    ...redirectRules,
    ...cmsRouteRedirects,
    ...sitemapFallback,
    ...appleMerchantFallback,
    ...(artifactDelivery?.mode === "artifact"
      ? artifactProxyRedirects(artifactDelivery.manifest, artifactDelivery.origin)
      : []),
    ...opaqueMediaProxy,
    ...mediaDocumentProxy,
    ...rewriteRules,
    "/*  /index.html  200",
    "",
  ].join("\n");
}

function renderHeaders() {
  const headers = parseJsonSetting(staticGenerationConfig.securityHeaders, DEFAULT_SECURITY_HEADERS, "Security headers");
  const configuredRootHeaders = staticGenerationConfig.securityHeadersEnabled && headers && typeof headers === "object"
    ? Object.entries(headers)
        .filter(([name, value]) => name && typeof value === "string" && !/[\r\n]/.test(value))
        .map(([name, value]) => [
          name,
          name.toLowerCase() === "content-security-policy"
            ? withStorefrontEditorPolicy(value, graphqlEndpoint)
            : value,
        ])
    : [];
  const rootHeaders = [
    ...configuredRootHeaders.filter(([name]) => name.toLowerCase() !== "cache-control"),
    ["Cache-Control", "public, max-age=0, must-revalidate"],
  ];
  return [
    "/*",
    ...rootHeaders.map(([name, value]) => `  ${name}: ${value}`),
    "",
    "/order/*",
    "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet",
    "  Cache-Control: private, no-store, max-age=0",
    "",
    "/shortcodes",
    "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet",
    "",
    "/shortcodes/*",
    "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet",
    "",
    "/layout-studio",
    "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet",
    "",
    "/layout-studio/*",
    "  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    "/sw.js",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/manifest.webmanifest",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/.well-known/apple-developer-merchantid-domain-association",
    "  Content-Type: text/plain; charset=UTF-8",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
  ].join("\n");
}

let staticGenerationConfig = DEFAULT_STATIC_GENERATION_CONFIG;
try {
  staticGenerationConfig = await discoverStaticGenerationConfig();
} catch (error) {
  if (process.env.CMS_STATIC_GENERATION_REQUIRED === "true") throw error;
  console.warn(
    `Static-generation configuration discovery skipped: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let configuredLanguages = [];
let configuredLanguageCodes = [];
try {
  configuredLanguages = await discoverLanguages();
  configuredLanguageCodes = configuredLanguages.map(({ routeCode }) => routeCode);
} catch (error) {
  if (backendProfile === "full") {
    throw new Error(
      `Language discovery failed; refusing to generate a partial sitemap: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  console.warn(
    `Optional language discovery unavailable for the ${backendProfile} profile; generating single-language routes: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let staticChromeConfig = DEFAULT_STATIC_CHROME;
try {
  staticChromeConfig = await discoverStaticChrome();
} catch (error) {
  console.warn(
    `Static chrome discovery skipped: ${error instanceof Error ? error.message : String(error)}`,
  );
}
const staticStyleAsset = await buildStaticStyleAsset(staticChromeConfig);
const effectiveSiteUrl = (environmentSiteUrl || staticGenerationConfig.frontendUrl)?.replace(/\/+$/, "");
const sitemapOrigin = effectiveSiteUrl || "http://localhost:4173";

let routeSeoSupported = false;
try {
  routeSeoSupported = await discoverRouteSeoSupport();
} catch (error) {
  console.warn(
    `Optional route SEO discovery unavailable for the ${backendProfile} profile: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let publicRobotsSupported = false;
try {
  publicRobotsSupported = await discoverPublicRobotsSupport();
} catch (error) {
  console.warn(
    `Optional public robots discovery unavailable; using core route metadata: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let cmsRoutes = [];
try {
  cmsRoutes = await discoverCmsRoutes({
    publicRobotsSupported,
    seoSupported: routeSeoSupported,
  });
} catch (error) {
  throw new Error(
    `CMS route discovery failed; refusing to generate a partial sitemap: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

let communityRoutes = [];
if (backendProfile === "full") {
  try {
    communityRoutes = await discoverCommunityRoutes();
  } catch (error) {
    throw new Error(
      `Community route discovery failed; refusing to generate a partial sitemap: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

const routesByPath = new Map();
for (const route of cmsRoutes) routesByPath.set(route.path, route);
for (const route of communityRoutes) routesByPath.set(route.path, route);
const discoveredRoutes = [...cmsRoutes, ...communityRoutes];
const stableLanguageCodes = configuredLanguageCodes.length >= 2 ? configuredLanguageCodes : [configuredLanguageCodes[0] || defaultLanguage];
const hiddenPresentationPaths = new Set(
  ["/shortcodes", "/layout-studio"].flatMap((path) => [
    path,
    ...stableLanguageCodes.map((languageCode) =>
      normalizeLanguageRoutePath(path, languageCode, configuredLanguageCodes)),
  ]),
);
for (const path of hiddenPresentationPaths) routesByPath.delete(path);
for (const stableRoute of stableRoutes) {
  for (const languageCode of stableLanguageCodes) {
    if (!stableRouteIsAvailable(stableRoute, discoveredRoutes, languageCode)) continue;
    const route = {
      ...stableRoute,
      path: normalizeLanguageRoutePath(stableRoute.path, languageCode, configuredLanguageCodes),
      lang: languageCode,
    };
    if (route.path === "/sitemap" && !staticGenerationConfig.sitemapEnabled) continue;
    const cmsRoute = routesByPath.get(route.path);
    routesByPath.set(route.path, {
      ...route,
      ...cmsRoute,
      robots: route.robots,
      indexable: route.indexable,
      path: route.path,
      lang: cmsRoute?.lang || route.lang,
      source: cmsRoute?.source || "stable",
      type: cmsRoute?.type || route.type || "StorefrontRoute",
    });
  }
}
const routes = [...routesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
const privateRoutePaths = new Set(
  stableRoutes
    .filter(({ indexable }) => !indexable)
    .flatMap(({ path }) =>
      stableLanguageCodes.map((languageCode) =>
        normalizeLanguageRoutePath(path, languageCode, configuredLanguageCodes))),
);
const sitemapRoutes = routes.filter(({ path, source, indexable }) =>
  !privateRoutePaths.has(path) && (source === "cms" || indexable));
const sitemapRoutePaths = new Set(sitemapRoutes.map(({ path }) => path));
const generatedAt = new Date().toISOString();
await stampServiceWorkerVersion(generatedAt);
const hydrationLanguages = stableLanguageCodes.map((routeCode) =>
  configuredLanguages.find((language) => language.routeCode === routeCode)
  || { routeCode, backendCode: routeCode.toUpperCase() });
try {
  staticHydrationAssets = await buildStaticHydrationAssets(hydrationLanguages, generatedAt);
  staticRouteRegistryAsset = await writeStaticRouteRegistryAsset(routes, generatedAt);
  staticPageHydrationAssets = await buildStaticPageHydrationAssets(routes, generatedAt);
} catch (error) {
  console.warn(
    `[hydration] Static data assets unavailable; runtime loading remains enabled: ${error instanceof Error ? error.message : String(error)}`,
  );
}
await rm(resolve(outputDirectory, "storefront-shell.json"), { force: true });
if (artifactConfig.mode !== "off") {
  const manifest = createShellManifest({
    html: template,
    routes,
    localeCodes: configuredLanguageCodes,
    siteKey: artifactConfig.siteKey,
    artifactOrigin: artifactConfig.origin,
    shellVersion: process.env.STOREFRONT_ARTIFACT_SHELL_VERSION
      || process.env.COMMIT_REF
      || process.env.DEPLOY_ID,
    builtAt: generatedAt,
  });
  const publication = await publishShellManifestForMode({
    mode: artifactConfig.mode,
    manifest,
    artifactOrigin: artifactConfig.origin,
    signingSecret: artifactConfig.signingSecret,
  });
  if (!publication.published) {
    const signingHint = publication.error?.includes("artifact_invalid_signature")
      ? " Ensure the deployment STOREFRONT_ARTIFACT_SIGNING_SECRET exactly matches WordPress Build & Deploy > Artifact signing secret."
      : "";
    console.warn(
      `[artifacts] Shadow shell registration failed; static delivery remains authoritative: ${publication.error}${signingHint}`,
    );
  }
  artifactDelivery = {
    mode: artifactConfig.mode,
    origin: artifactConfig.origin,
    manifest,
    registration: publication.registration,
    registrationError: publication.error,
  };
  await writeFile(resolve(outputDirectory, "storefront-shell.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
if (!staticGenerationConfig.sitemapEnabled) {
  await rm(resolve(outputDirectory, "sitemap"), { recursive: true, force: true });
}

for (const route of routes) {
  const routeDirectory = resolve(outputDirectory, prerenderRouteDirectoryPath(route.path));
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(resolve(routeDirectory, "index.html"), await renderRoute(route));
}

await writeFile(
  resolve(outputDirectory, "static-routes.json"),
  `${JSON.stringify({
    version: 5,
    generatedAt,
    sitemapEnabled: staticGenerationConfig.sitemapEnabled,
    routes: routes.map(({ path, lang, title, description, source, type, indexable }) => ({
      path,
      lang,
      title,
      description,
      source,
      type,
      indexable,
      listed: sitemapRoutePaths.has(path),
    })),
  }, null, 2)}\n`,
);

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapRoutes.map(({ path }) => `  <url><loc>${escapeAttribute(`${sitemapOrigin}${path === "/" ? "" : path}`)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeControlledFile("sitemap.xml", staticGenerationConfig.sitemapEnabled, sitemapXml);

await writeControlledFile("robots.txt", staticGenerationConfig.robotsEnabled, staticGenerationConfig.robotsTxt);

await writeControlledFile("llms.txt", staticGenerationConfig.llmsEnabled, staticGenerationConfig.llmsTxt);
await writeControlledFile("llms-full.txt", staticGenerationConfig.llmsFullEnabled, staticGenerationConfig.llmsFullTxt);
await writeControlledFile("ai-brand-voice.txt", staticGenerationConfig.aiBrandVoiceEnabled, staticGenerationConfig.aiBrandVoice);
await writeControlledFile("ai-products.jsonld", staticGenerationConfig.aiProductsEnabled, staticGenerationConfig.aiProductsJsonld);
await writeControlledFile("ai-ranking-signals.txt", staticGenerationConfig.aiRankingEnabled, staticGenerationConfig.aiRankingSignals);
await writeControlledFile("ai-conversational-faq.json", staticGenerationConfig.aiFaqEnabled, staticGenerationConfig.aiFaqJson);
await writeControlledFile("ai-hallucination-defense.txt", staticGenerationConfig.aiDefenseEnabled, staticGenerationConfig.aiDefenseTxt);
const appleMerchantFileEnabled = await writeAppleMerchantFile(staticGenerationConfig.appleMerchantFile);
await writeFile(resolve(outputDirectory, "_redirects"), renderRedirects(appleMerchantFileEnabled));
await writeFile(resolve(outputDirectory, "_headers"), renderHeaders());
await writeFile(
  resolve(outputDirectory, "build-info.json"),
  `${JSON.stringify({
    generatedAt,
    badgeId: staticGenerationConfig.buildBadgeId || null,
    routes: routes.length,
    indexableRoutes: routes.filter(({ indexable }) => indexable).length,
    sitemapRoutes: sitemapRoutes.length,
    cmsRoutes: routes.filter(({ source }) => source === "cms").length,
    artifactMode: artifactDelivery?.mode || "off",
    artifactShellVersion: artifactDelivery?.manifest.shellVersion || null,
    artifactSeedRoutes: artifactDelivery?.manifest.seedRoutes.length || 0,
  }, null, 2)}\n`,
);

const generatedCmsRouteCount = routes.filter(({ source }) => source === "cms").length;
const sitemapSummary = staticGenerationConfig.sitemapEnabled ? `${sitemapRoutes.length} sitemap URLs` : "sitemap disabled";
console.log(`Generated ${routes.length} static route entries (${generatedCmsRouteCount} discovered from CMS); ${sitemapSummary}.`);
