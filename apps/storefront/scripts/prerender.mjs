import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withStorefrontEditorPolicy } from "./security-policy.mjs";
import { normalizeStaticShortcodes } from "../src/lib/staticShortcodeMarkup.mjs";
import { cmsRouteFromNode, normalizedRoutePath, normalizeLanguageRoutePath } from "./route-paths.mjs";
import { hasOnlyMissingField, hasOnlyMissingRootField } from "./optional-graphql.mjs";
import { buildCoreRoutesQuery, buildRoutesQuery } from "./route-query.mjs";
import {
  artifactConfigFromEnvironment,
  artifactProxyRedirects,
  createShellManifest,
  publishShellManifest,
} from "./artifact-publish.mjs";

const outputDirectory = resolve("dist");
const template = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const environmentSiteUrl = (process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL)?.replace(/\/+$/, "");
const graphqlRequestOrigin = environmentSiteUrl ? new URL(environmentSiteUrl).origin : "";
const graphqlEndpoint = process.env.VITE_GRAPHQL_ENDPOINT?.trim();
const defaultLanguage = process.env.VITE_DEFAULT_LANGUAGE?.trim().toLowerCase() || "en";
const configuredBackendProfile = process.env.VITE_BACKEND_PROFILE?.trim().toLowerCase() || "full";
const backendProfile = ["shell", "blog", "shop", "full"].includes(configuredBackendProfile)
  ? configuredBackendProfile
  : "full";
const commerceRoutesAvailable = backendProfile === "shop" || backendProfile === "full";
const expectedLanguages = (process.env.STOREFRONT_EXPECTED_LOCALES || "")
  .split(",")
  .map((locale) => locale.trim().toLowerCase())
  .filter((locale) => /^[a-z]{2}(?:-[a-z0-9]+)*$/.test(locale));
const artifactConfig = artifactConfigFromEnvironment();
let artifactDelivery = null;
let backendLanguageFieldsAvailable = true;

const stableRoutes = [
  { path: "/", lang: "en", title: "FunkyCommerce", description: "A modern storefront experience for shopping, stories, and community.", indexable: true },
  { path: "/shop", lang: "en", title: "Shop | FunkyCommerce", description: "Browse the latest FunkyCommerce products and collections.", indexable: true },
  { path: "/product-brand", lang: "en", title: "Product brands | FunkyCommerce", description: "Browse every brand with products available in the FunkyCommerce catalog.", type: "ProductBrandDirectory", indexable: true },
  { path: "/blog", lang: "en", title: "Journal | FunkyCommerce", description: "Stories, guides, and inspiration from FunkyCommerce.", indexable: true },
  { path: "/author", lang: "en", title: "Authors | FunkyCommerce", description: "Meet the authors publishing stories on FunkyCommerce.", type: "AuthorDirectory", indexable: true },
  { path: "/sitemap", lang: "en", title: "Sitemap | FunkyCommerce", description: "Browse every public page, product, story, archive, author, and community post.", indexable: true },
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

const LANGUAGES_QUERY = `
  query StorefrontLanguages {
    languages { code slug }
  }
`;

const STATIC_GENERATION_CONFIG_QUERY = `
  query StorefrontStaticGenerationConfig {
    funkycommerceStaticGenerationConfig
  }
`;

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

const DEFAULT_CSP = "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' https: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
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

async function requestGraphql(query, variables, operationLabel, { optionalField, optionalRootField } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(graphqlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(graphqlRequestOrigin ? { Origin: graphqlRequestOrigin } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
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
        throw new Error(payload.errors.map(({ message }) => message).join("; "));
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
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
    { optionalRootField: "funkycommerceStaticGenerationConfig" },
  );
  const serialized = payload.data?.funkycommerceStaticGenerationConfig;
  if (serialized == null) return DEFAULT_STATIC_GENERATION_CONFIG;
  if (typeof serialized !== "string") throw new Error("WPGraphQL returned no static-generation configuration");
  const parsed = JSON.parse(serialized);
  return { ...DEFAULT_STATIC_GENERATION_CONFIG, ...parsed };
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
      { optionalRootField: "languages" },
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
    throw error;
  }
  const languages = (payload.data?.languages || [])
    .flatMap(({ slug, code }) => {
      const routeCode = (slug || code || "").trim().toLowerCase();
      const backendCode = (code || "").trim().toUpperCase();
      return routeCode && backendCode ? [{ routeCode, backendCode }] : [];
    });
  backendLanguageFieldsAvailable = languages.length > 0;
  return languages;
}

async function discoverRouteSeoSupport() {
  if (!graphqlEndpoint) return false;
  const payload = await requestGraphql(
    ROUTE_SEO_SUPPORT_QUERY,
    {},
    "WPGraphQL route SEO support",
    { optionalField: { fieldName: "seo", typeName: "Post" } },
  );
  return Boolean(payload.data?.posts);
}

async function discoverRouteNodes(query, connections, operationLabel) {
  const discoveredNodes = [];
  let readingSettings;
  const cursors = Object.fromEntries(connections.map(({ cursorName }) => [cursorName, null]));
  const complete = Object.fromEntries(connections.map(({ responseName }) => [responseName, false]));

  while (!Object.values(complete).every(Boolean)) {
    const payload = await requestGraphql(query, cursors, operationLabel);
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

async function discoverCoreRouteNodesIndividually({ multilingual, seo }) {
  const discoveredNodes = [];
  let readingSettings;
  for (const connection of CORE_ROUTE_CONNECTIONS) {
    const result = await discoverRouteNodes(
      buildCoreRoutesQuery({
        connections: [connection.responseName],
        multilingual,
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

async function discoverCmsRoutes({ seoSupported = false } = {}) {
  if (!graphqlEndpoint) return [];

  const multilingual = backendLanguageFieldsAvailable && configuredLanguageCodes.length > 0;
  let discovery;
  try {
    discovery = await discoverRouteNodes(
      buildRoutesQuery({
        commerce: commerceRoutesAvailable,
        multilingual,
        seo: seoSupported,
      }),
      [
        { responseName: "contentNodes", cursorName: "contentAfter", routeConnectionName: "contentNodes" },
        { responseName: "terms", cursorName: "termAfter", routeConnectionName: "terms" },
        { responseName: "users", cursorName: "userAfter", routeConnectionName: "users" },
      ],
      "WPGraphQL route discovery",
    );
  } catch (error) {
    if (commerceRoutesAvailable || backendProfile === "full") throw error;
    console.warn(
      `Generic route discovery unavailable for the ${backendProfile} profile; retrying standard free connections: ${error instanceof Error ? error.message : String(error)}`,
    );
    try {
      discovery = await discoverRouteNodes(
        buildCoreRoutesQuery({ multilingual, seo: seoSupported }),
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
        seo: seoSupported,
      });
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
    const route = cmsRouteFromNode(
      node?.__typename === "Page"
        ? { ...node, isFrontPage: frontPageIds.has(node.databaseId) }
        : node,
      connectionName,
      defaultLanguage,
      configuredLanguageCodes,
    );
    return route ? [route] : [];
  });
}

function optimizeStaticCmsHtml(html, { placeholders = false } = {}) {
  let priorityAssigned = false;
  return normalizeStaticShortcodes(html, { placeholders })
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\2/gi, "")
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/<(\/?)main\b/gi, "<$1div")
    .replace(/<img\b([^>]*)>/gi, (_match, attributes) => {
      const source = attributes.match(/\ssrc=(["'])(.*?)\1/i)?.[2]?.trim();
      if (!source) return "";
      let optimized = attributes
        .replace(/\sloading=(["']).*?\1/gi, "")
        .replace(/\sfetchpriority=(["']).*?\1/gi, "");
      if (!/\salt=(["']).*?\1/i.test(optimized)) optimized += ' alt=""';
      if (!/\sdecoding=(["']).*?\1/i.test(optimized)) optimized += ' decoding="async"';
      if (!priorityAssigned) {
        optimized += ' loading="eager" fetchpriority="high"';
        priorityAssigned = true;
      } else {
        optimized = optimized
          .replace(/\ssrcset=(["'])(.*?)\1/gi, ' data-prerender-srcset=$1$2$1')
          .replace(/\ssrc=(["'])(.*?)\1/gi, ' data-prerender-src=$1$2$1');
        optimized += ' loading="lazy"';
      }

      return `<img${optimized}>`;
    });
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

function renderRoute(route) {
  const pageSnapshot = route.type === "Page" && route.cmsContent
    ? optimizeStaticCmsHtml(route.cmsContent, { placeholders: true })
    : "";
  const isHome = route.path === normalizeLanguageRoutePath("/", route.lang, configuredLanguageCodes);
  const heroImage = isHome
    ? pageSnapshot.match(/\bdata-image=(["'])(https?:\/\/[^"']+)\1/i)?.[2]
    : "";
  const heroPreload = heroImage
    ? `\n    <link rel="preload" as="image" href="${escapeAttribute(heroImage)}" fetchpriority="high" />`
    : "";
  const seoHead = renderSeoHead(route);

  let rendered = template
    .replace('<html lang="en">', `<html lang="${route.lang}">`)
    .replace(/\s*<title(?:\s[^>]*)?>.*?<\/title>/, "")
    .replace(
      /\s*<meta name="description" content=".*?" \/>/,
      `\n    ${seoHead}${heroPreload}`,
    );
  if (!staticGenerationConfig.sitemapEnabled) {
    rendered = rendered.replace(/\s*<link rel="sitemap"[^>]*\/>/, "");
  }
  if (pageSnapshot) {
    rendered = rendered
      .replace(
        '<div id="root"></div>',
        `<div id="root"><main id="prerendered-storefront" aria-label="Storefront content"><section aria-label="${escapeAttribute(route.title)} content" data-cms-page><div class="wp-site-blocks entry-content is-layout-flow">${pageSnapshot}</div></section></main></div>`,
      );
  }
  return injectBuildScripts(rendered);
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
  const sitemapFallback = staticGenerationConfig.sitemapEnabled ? [] : ["/sitemap  /index.html  404"];
  const appleMerchantFallback = appleMerchantFileEnabled
    ? []
    : ["/.well-known/apple-developer-merchantid-domain-association  /index.html  404"];
  return [
    "/product.feed.xml  /product-feed.xml  301",
    ...redirectRules,
    ...sitemapFallback,
    ...appleMerchantFallback,
    ...(artifactDelivery?.mode === "artifact"
      ? artifactProxyRedirects(artifactDelivery.manifest, artifactDelivery.origin)
      : []),
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
const effectiveSiteUrl = (environmentSiteUrl || staticGenerationConfig.frontendUrl)?.replace(/\/+$/, "");
const sitemapOrigin = effectiveSiteUrl || "http://localhost:4173";

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

let routeSeoSupported = false;
try {
  routeSeoSupported = await discoverRouteSeoSupport();
} catch (error) {
  if (backendProfile === "full") {
    throw new Error(
      `Route SEO discovery failed; refusing to generate a partial sitemap: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  console.warn(
    `Optional route SEO discovery unavailable for the ${backendProfile} profile: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let cmsRoutes = [];
try {
  cmsRoutes = await discoverCmsRoutes({ seoSupported: routeSeoSupported });
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
const stableLanguageCodes = configuredLanguageCodes.length >= 2 ? configuredLanguageCodes : [configuredLanguageCodes[0] || defaultLanguage];
for (const stableRoute of stableRoutes) {
  for (const languageCode of stableLanguageCodes) {
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
  const registration = await publishShellManifest({
    manifest,
    artifactOrigin: artifactConfig.origin,
    signingSecret: artifactConfig.signingSecret,
  });
  artifactDelivery = {
    mode: artifactConfig.mode,
    origin: artifactConfig.origin,
    manifest,
    registration,
  };
  await writeFile(resolve(outputDirectory, "storefront-shell.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
if (!staticGenerationConfig.sitemapEnabled) {
  await rm(resolve(outputDirectory, "sitemap"), { recursive: true, force: true });
}

for (const route of routes) {
  const routeDirectory = route.path === "/" ? outputDirectory : resolve(outputDirectory, route.path.slice(1));
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(resolve(routeDirectory, "index.html"), renderRoute(route));
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
