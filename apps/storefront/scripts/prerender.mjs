import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("dist");
const template = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const environmentSiteUrl = (process.env.VITE_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL)?.replace(/\/+$/, "");
const graphqlEndpoint = process.env.VITE_GRAPHQL_ENDPOINT?.trim();
const defaultLanguage = process.env.VITE_DEFAULT_LANGUAGE?.trim().toLowerCase() || "en";

const stableRoutes = [
  { path: "/", lang: "en", title: "FunkyCommerce", description: "A modern storefront experience for shopping, stories, and community.", indexable: true },
  { path: "/en", lang: "en", title: "FunkyCommerce", description: "A modern storefront experience for shopping, stories, and community.", indexable: true },
  { path: "/pl", lang: "pl", title: "FunkyCommerce", description: "Nowoczesny sklep internetowy, artykuly i spolecznosc.", indexable: true },
  { path: "/shop", lang: "en", title: "Shop | FunkyCommerce", description: "Browse the latest FunkyCommerce products and collections.", indexable: true },
  { path: "/blog", lang: "en", title: "Journal | FunkyCommerce", description: "Stories, guides, and inspiration from FunkyCommerce.", indexable: true },
  { path: "/sitemap", lang: "en", title: "Sitemap | FunkyCommerce", description: "Browse every public page, product, story, archive, author, and community post.", indexable: true },
  { path: "/cart", lang: "en", title: "Cart | FunkyCommerce", description: "Review the products in your FunkyCommerce cart.", indexable: false },
  { path: "/checkout", lang: "en", title: "Checkout | FunkyCommerce", description: "Complete your FunkyCommerce order securely.", indexable: false },
  { path: "/account", lang: "en", title: "My account | FunkyCommerce", description: "Manage your FunkyCommerce account and orders.", indexable: false },
  { path: "/wishlist", lang: "en", title: "Wishlist | FunkyCommerce", description: "View your saved FunkyCommerce products.", indexable: false },
  { path: "/reading-list", lang: "en", title: "Reading list | FunkyCommerce", description: "Return to your saved FunkyCommerce stories.", indexable: false },
  { path: "/community", lang: "en", title: "Community | FunkyCommerce", description: "Discover creators and conversations in the FunkyCommerce community.", indexable: true },
  { path: "/auth", lang: "en", title: "Sign in | FunkyCommerce", description: "Sign in to your FunkyCommerce account.", indexable: false },
  { path: "/order-success", lang: "en", title: "Order confirmed | FunkyCommerce", description: "Your FunkyCommerce order has been confirmed.", indexable: false },
  { path: "/unsubscribe", lang: "en", title: "Email preferences | FunkyCommerce", description: "Update your FunkyCommerce email preferences.", indexable: false },
];

const ROUTABLE_CMS_TYPES = new Set([
  "Category",
  "CommunityPost",
  "Page",
  "Post",
  "ProductBrand",
  "ProductCategory",
  "ProductTag",
  "SimpleProduct",
  "Tag",
  "User",
  "VariableProduct",
]);

const BUILD_ROUTES_QUERY = `
  query StorefrontBuildRoutes($contentAfter: String, $termAfter: String, $userAfter: String) {
    contentNodes(first: 100, after: $contentAfter) {
      nodes {
        uri
        __typename
        ... on NodeWithTitle {
          title
        }
      }
      pageInfo { hasNextPage endCursor }
    }
    terms(first: 100, after: $termAfter) {
      nodes { uri __typename name }
      pageInfo { hasNextPage endCursor }
    }
    users(first: 100, after: $userAfter) {
      nodes { uri name }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const STATIC_GENERATION_CONFIG_QUERY = `
  query StorefrontStaticGenerationConfig {
    funkycommerceStaticGenerationConfig
  }
`;

const DEFAULT_SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(self)",
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
};

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizedRoutePath(uri) {
  if (typeof uri !== "string" || !uri.startsWith("/") || uri.startsWith("//")) return null;
  const parsed = new URL(uri, "https://storefront.invalid");
  if (parsed.origin !== "https://storefront.invalid") return null;

  const path = decodeURIComponent(parsed.pathname).replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  if (path.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return encodeURI(path);
}

function routeLanguage(path) {
  return path.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase() || defaultLanguage;
}

function contentDescription(type) {
  if (type === "Post") return "Read this story on FunkyCommerce.";
  if (type?.includes("Product")) return "Discover this product or collection on FunkyCommerce.";
  if (type === "CommunityPost") return "Join this conversation in the FunkyCommerce community.";
  if (type === "User") return "View this creator profile on FunkyCommerce.";
  return "Explore this page on FunkyCommerce.";
}

async function requestGraphql(query, variables, operationLabel) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(graphqlEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${operationLabel} failed with status ${response.status}`);

      const payload = await response.json();
      if (payload.errors?.length) {
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
  const payload = await requestGraphql(STATIC_GENERATION_CONFIG_QUERY, {}, "WPGraphQL static-generation configuration");
  const serialized = payload.data?.funkycommerceStaticGenerationConfig;
  if (typeof serialized !== "string") throw new Error("WPGraphQL returned no static-generation configuration");
  const parsed = JSON.parse(serialized);
  return { ...DEFAULT_STATIC_GENERATION_CONFIG, ...parsed };
}

async function discoverCmsRoutes() {
  if (!graphqlEndpoint) return [];

  const discovered = [];
  const cursors = { contentAfter: null, termAfter: null, userAfter: null };
  const complete = { contentNodes: false, terms: false, users: false };

  while (!Object.values(complete).every(Boolean)) {
    const payload = await requestGraphql(BUILD_ROUTES_QUERY, cursors, "WPGraphQL route discovery");

    const connections = [
      ["contentNodes", "contentAfter", "title"],
      ["terms", "termAfter", "name"],
      ["users", "userAfter", "name"],
    ];
    for (const [connectionName, cursorName, labelName] of connections) {
      if (complete[connectionName]) continue;
      const connection = payload.data?.[connectionName];
      if (!connection) throw new Error(`WPGraphQL route discovery omitted ${connectionName}`);

      for (const node of connection.nodes || []) {
        const path = normalizedRoutePath(node.uri);
        if (!path) continue;
        const label = node[labelName]?.trim() || "FunkyCommerce";
        const type = connectionName === "users" ? "User" : node.__typename;
        if (!ROUTABLE_CMS_TYPES.has(type)) continue;
        discovered.push({
          path,
          lang: routeLanguage(path),
          title: `${label} | FunkyCommerce`,
          description: contentDescription(type),
          source: "cms",
          type,
          indexable: true,
        });
      }

      complete[connectionName] = !connection.pageInfo.hasNextPage;
      cursors[cursorName] = connection.pageInfo.endCursor;
    }
  }

  return discovered;
}

function renderRoute(route) {
  const canonical = effectiveSiteUrl
    ? `\n    <link rel="canonical" href="${escapeAttribute(`${effectiveSiteUrl}${route.path === "/" ? "" : route.path}`)}" />`
    : "";

  let rendered = template
    .replace('<html lang="en">', `<html lang="${route.lang}">`)
    .replace(/<title>.*?<\/title>/, `<title>${escapeAttribute(route.title)}</title>`)
    .replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${escapeAttribute(route.description)}" />${canonical}`,
    );
  if (!staticGenerationConfig.sitemapEnabled) {
    rendered = rendered.replace(/\s*<link rel="sitemap"[^>]*\/>/, "");
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
  return html
    .replace("</head>", `${headContent ? `    ${headContent}\n` : ""}  </head>`)
    .replace("<body>", `<body>${bodyContent ? `\n    ${bodyContent}` : ""}`);
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

function parseJsonSetting(value, fallback, label) {
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`${label} contained invalid JSON; using its safe fallback.`);
    return fallback;
  }
}

function renderRedirects() {
  const rules = parseJsonSetting(staticGenerationConfig.redirectRules, [], "Frontend redirects");
  const renderedRules = Array.isArray(rules)
    ? rules.flatMap((rule) => {
        const from = typeof rule?.from === "string" ? rule.from.trim() : "";
        const to = typeof rule?.to === "string" ? rule.to.trim() : "";
        const status = [200, 301, 302, 307, 308].includes(Number(rule?.status)) ? Number(rule.status) : 301;
        if (!from.startsWith("/") || !to || /[\r\n\s]/.test(from) || /[\r\n\s]/.test(to)) return [];
        return [`${from}  ${to}  ${status}${rule.force ? "!" : ""}`];
      })
    : [];
  const sitemapFallback = staticGenerationConfig.sitemapEnabled ? [] : ["/sitemap  /index.html  404"];
  return [...renderedRules, ...sitemapFallback, "/*  /index.html  200", ""].join("\n");
}

function renderHeaders() {
  const headers = parseJsonSetting(staticGenerationConfig.securityHeaders, DEFAULT_SECURITY_HEADERS, "Security headers");
  const rootHeaders = staticGenerationConfig.securityHeadersEnabled && headers && typeof headers === "object"
    ? Object.entries(headers).filter(([name, value]) => name && typeof value === "string" && !/[\r\n]/.test(value))
    : [];
  return [
    ...(rootHeaders.length ? ["/*", ...rootHeaders.map(([name, value]) => `  ${name}: ${value}`), ""] : []),
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    "/sw.js",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/manifest.webmanifest",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
  ].join("\n");
}

let staticGenerationConfig = DEFAULT_STATIC_GENERATION_CONFIG;
try {
  staticGenerationConfig = await discoverStaticGenerationConfig();
} catch (error) {
  console.warn(`Static-generation controls unavailable; using defaults: ${error instanceof Error ? error.message : String(error)}`);
}
const effectiveSiteUrl = (environmentSiteUrl || staticGenerationConfig.frontendUrl)?.replace(/\/+$/, "");
const sitemapOrigin = effectiveSiteUrl || "http://localhost:4173";

let cmsRoutes = [];
try {
  cmsRoutes = await discoverCmsRoutes();
} catch (error) {
  console.warn(`CMS route discovery skipped: ${error instanceof Error ? error.message : String(error)}`);
}

const routesByPath = new Map();
for (const route of cmsRoutes) routesByPath.set(route.path, route);
for (const route of stableRoutes) {
  if (route.path === "/sitemap" && !staticGenerationConfig.sitemapEnabled) continue;
  routesByPath.set(route.path, { ...route, source: "stable", type: "StorefrontRoute" });
}
const routes = [...routesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
const indexableRoutes = routes.filter(({ indexable }) => indexable);
const generatedAt = new Date().toISOString();
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
    version: 4,
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
    })),
  }, null, 2)}\n`,
);

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexableRoutes.map(({ path }) => `  <url><loc>${escapeAttribute(`${sitemapOrigin}${path === "/" ? "" : path}`)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeControlledFile("sitemap.xml", staticGenerationConfig.sitemapEnabled, sitemapXml);

const privatePaths = stableRoutes.filter(({ indexable }) => !indexable).map(({ path }) => `Disallow: ${path}`);
const configuredRobots = staticGenerationConfig.robotsTxt.replace(/^Sitemap:.*$/gim, "").trim();
const robotsContent = [
  configuredRobots || "User-agent: *\nAllow: /",
  ...privatePaths,
  ...(staticGenerationConfig.sitemapEnabled ? ["", `Sitemap: ${sitemapOrigin}/sitemap.xml`] : []),
  "",
].join("\n");
await writeControlledFile("robots.txt", staticGenerationConfig.robotsEnabled, robotsContent);

await writeControlledFile("llms.txt", staticGenerationConfig.llmsEnabled, staticGenerationConfig.llmsTxt);
await writeControlledFile("llms-full.txt", staticGenerationConfig.llmsFullEnabled, staticGenerationConfig.llmsFullTxt);
await writeControlledFile("ai-brand-voice.txt", staticGenerationConfig.aiBrandVoiceEnabled, staticGenerationConfig.aiBrandVoice);
await writeControlledFile("ai-products.jsonld", staticGenerationConfig.aiProductsEnabled, staticGenerationConfig.aiProductsJsonld);
await writeControlledFile("ai-ranking-signals.txt", staticGenerationConfig.aiRankingEnabled, staticGenerationConfig.aiRankingSignals);
await writeControlledFile("ai-conversational-faq.json", staticGenerationConfig.aiFaqEnabled, staticGenerationConfig.aiFaqJson);
await writeControlledFile("ai-hallucination-defense.txt", staticGenerationConfig.aiDefenseEnabled, staticGenerationConfig.aiDefenseTxt);
await writeControlledFile(
  ".well-known/apple-developer-merchantid-domain-association",
  Boolean(staticGenerationConfig.appleMerchantFile.trim()),
  staticGenerationConfig.appleMerchantFile,
);
await writeFile(resolve(outputDirectory, "_redirects"), renderRedirects());
await writeFile(resolve(outputDirectory, "_headers"), renderHeaders());
await writeFile(
  resolve(outputDirectory, "build-info.json"),
  `${JSON.stringify({
    generatedAt,
    badgeId: staticGenerationConfig.buildBadgeId || null,
    routes: routes.length,
    indexableRoutes: indexableRoutes.length,
    cmsRoutes: routes.filter(({ source }) => source === "cms").length,
  }, null, 2)}\n`,
);

const generatedCmsRouteCount = routes.filter(({ source }) => source === "cms").length;
const sitemapSummary = staticGenerationConfig.sitemapEnabled ? `${indexableRoutes.length} sitemap URLs` : "sitemap disabled";
console.log(`Generated ${routes.length} static route entries (${generatedCmsRouteCount} discovered from CMS); ${sitemapSummary}.`);
