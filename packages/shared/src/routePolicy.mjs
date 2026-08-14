const ROUTE_BASE = "https://storefront.invalid";

export const PUBLIC_ARTIFACT_VARIANT = "public";

export const PRIVATE_DOCUMENT_PREFIXES = Object.freeze([
  "/account",
  "/auth",
  "/cart",
  "/checkout",
  "/layout-studio",
  "/oauth",
  "/order",
  "/order-success",
  "/reading-list",
  "/reset-password",
  "/unsubscribe",
  "/wishlist",
]);

export const DOCUMENT_BYPASS_PREFIXES = Object.freeze([
  "/.netlify",
  "/.well-known",
  "/api",
  "/assets",
  "/assistant-model",
  "/graphql",
  "/icons",
  "/wp-admin",
  "/wp-json",
]);

const DOCUMENT_BYPASS_PATHS = new Set([
  "/_headers",
  "/_redirects",
  "/favicon.ico",
  "/llms.txt",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
  "/wp-login.php",
]);

const STATIC_FILE_EXTENSION =
  /\.(?:avif|css|csv|eot|gif|gz|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|svg|txt|webmanifest|webm|webp|woff2?|xml|zip)$/i;

function matchesPathPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function withoutLocalePrefix(path, localeCodes) {
  const segments = path.split("/");
  const first = segments[1]?.toLowerCase();
  const locales = new Set(
    (Array.isArray(localeCodes) ? localeCodes : [])
      .filter((locale) => typeof locale === "string")
      .map((locale) => locale.trim().replaceAll("_", "-").toLowerCase())
      .filter(Boolean),
  );
  return first && locales.has(first) ? `/${segments.slice(2).join("/")}` || "/" : path;
}

export function normalizePublicRoutePath(input) {
  if (
    typeof input !== "string"
    || !input.startsWith("/")
    || input.startsWith("//")
    || input.includes("\\")
  ) {
    return null;
  }

  for (const segment of input.split(/[?#]/, 1)[0].split("/")) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (decoded === "." || decoded === "..") return null;
  }

  let parsed;
  try {
    parsed = new URL(input, ROUTE_BASE);
  } catch {
    return null;
  }

  if (
    parsed.origin !== ROUTE_BASE
    || parsed.search
    || parsed.hash
    || /[\u0000-\u001f\u007f]/.test(parsed.pathname)
  ) {
    return null;
  }

  const encodedSegments = [];
  for (const segment of parsed.pathname.split("/")) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      decoded === "."
      || decoded === ".."
      || decoded.includes("\\")
      || /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return null;
    }
    encodedSegments.push(encodeURIComponent(decoded));
  }

  return encodedSegments.join("/").replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function classifyStorefrontRequest(request) {
  const method = typeof request?.method === "string"
    ? request.method.trim().toUpperCase()
    : "GET";
  if (method !== "GET" && method !== "HEAD") {
    return { kind: "bypass", reason: "method", normalizedPath: null };
  }

  if (request?.authenticated) {
    return { kind: "private-document", reason: "authenticated", normalizedPath: null };
  }
  if (request?.preview) {
    return { kind: "private-document", reason: "preview", normalizedPath: null };
  }
  if (request?.visibility === "private") {
    return { kind: "private-document", reason: "private-route", normalizedPath: null };
  }
  if (request?.visibility === "bypass") {
    return { kind: "bypass", reason: "non-document", normalizedPath: null };
  }

  if (typeof request?.target !== "string") {
    return { kind: "bypass", reason: "invalid-route", normalizedPath: null };
  }

  let parsed;
  try {
    parsed = new URL(request.target, ROUTE_BASE);
  } catch {
    return { kind: "bypass", reason: "invalid-route", normalizedPath: null };
  }

  if (parsed.origin !== ROUTE_BASE || parsed.hash) {
    return { kind: "bypass", reason: "invalid-route", normalizedPath: null };
  }
  if (parsed.search) {
    return { kind: "bypass", reason: "query", normalizedPath: null };
  }

  const normalizedPath = normalizePublicRoutePath(parsed.pathname);
  if (!normalizedPath) {
    return { kind: "bypass", reason: "invalid-route", normalizedPath: null };
  }

  if (
    DOCUMENT_BYPASS_PATHS.has(normalizedPath)
    || DOCUMENT_BYPASS_PREFIXES.some((prefix) => matchesPathPrefix(normalizedPath, prefix))
    || STATIC_FILE_EXTENSION.test(normalizedPath)
  ) {
    return { kind: "bypass", reason: "non-document", normalizedPath };
  }

  const policyPath = withoutLocalePrefix(normalizedPath, request.localeCodes).toLowerCase();
  if (PRIVATE_DOCUMENT_PREFIXES.some((prefix) => matchesPathPrefix(policyPath, prefix))) {
    return { kind: "private-document", reason: "private-route", normalizedPath };
  }

  return { kind: "public-artifact", reason: "public-document", normalizedPath };
}
