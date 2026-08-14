import { createHash, createHmac, randomUUID } from "node:crypto";

import { classifyStorefrontRequest, normalizePublicRoutePath } from "@funky/shared/route-policy";

const ARTIFACT_API_PATH = "/wp-json/funkycommerce-artifacts/v1";
const SITE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CORE_STABLE_ARTIFACT_ROUTES = new Set(["/", "/shop", "/blog", "/community"]);

function requireHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a credential-free HTTPS URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL.`);
  }
  return url;
}

export function normalizeArtifactLocale(value) {
  const normalized = String(value || "").trim().replaceAll("_", "-");
  const match = normalized.match(/^([a-z]{2,3})(?:-([a-z]{2}))?$/i);
  if (!match) throw new Error(`Unsupported artifact locale: ${value}.`);
  return match[2] ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}` : match[1].toLowerCase();
}

export function artifactConfigFromEnvironment(environment = process.env) {
  const mode = (environment.STOREFRONT_ARTIFACT_MODE || "off").trim().toLowerCase();
  if (!["off", "shadow", "artifact"].includes(mode)) {
    throw new Error("STOREFRONT_ARTIFACT_MODE must be off, shadow, or artifact.");
  }
  if (mode === "off") return { mode };

  const origin = requireHttpsUrl(environment.STOREFRONT_ARTIFACT_ORIGIN || "", "STOREFRONT_ARTIFACT_ORIGIN");
  const siteKey = (environment.STOREFRONT_ARTIFACT_SITE_KEY || "").trim();
  const signingSecret = environment.STOREFRONT_ARTIFACT_SIGNING_SECRET || "";
  if (!SITE_KEY_PATTERN.test(siteKey)) {
    throw new Error("STOREFRONT_ARTIFACT_SITE_KEY is invalid.");
  }
  if (signingSecret.length < 32) {
    throw new Error("STOREFRONT_ARTIFACT_SIGNING_SECRET must contain at least 32 characters.");
  }
  return {
    mode,
    origin: origin.origin,
    siteKey,
    signingSecret,
  };
}

function extractAttribute(attributes, name) {
  return attributes.match(new RegExp(`\\s${name}=(["'])(.*?)\\1`, "i"))?.[2] || "";
}

export function extractShellAssets(html) {
  const assets = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const url = extractAttribute(match[1], "src");
    if (url) assets.push({ kind: "script", url });
  }
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const url = extractAttribute(match[1], "href");
    const rel = extractAttribute(match[1], "rel").toLowerCase();
    if (!url) continue;
    if (rel === "stylesheet") assets.push({ kind: "style", url });
    else if (rel === "modulepreload") assets.push({ kind: "modulepreload", url });
    else if (["icon", "manifest", "apple-touch-icon"].includes(rel)) assets.push({ kind: "asset", url });
  }
  return [...new Map(assets.map((asset) => [`${asset.kind}|${asset.url}`, asset])).values()];
}

export function createShellTemplate(html, { artifactOrigin, shellVersion }) {
  const revisionEndpoint = `${artifactOrigin}${ARTIFACT_API_PATH}/revision`;
  let shell = html
    .replace(/\s*<title(?:\s[^>]*)?>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name=(["'])description\1[^>]*>/i, "")
    .replace(
      "</head>",
      `    <meta name="storefront-artifact-shell" content="${shellVersion}">\n`
        + `    <meta name="storefront-artifact-revision-endpoint" content="${revisionEndpoint}">\n`
        + "    <!--storefront-artifact-head-->\n"
        + "    <!--storefront-artifact-css-->\n"
        + "  </head>",
    )
    .replace(
      '<div id="root"></div>',
      '<div id="root"><!--storefront-artifact-content--></div>\n'
        + "    <!--storefront-artifact-payload-->",
    );
  for (const slot of ["head", "css", "content", "payload"]) {
    if (shell.split(`<!--storefront-artifact-${slot}-->`).length !== 2) {
      throw new Error(`Built storefront shell must contain exactly one ${slot} slot.`);
    }
  }
  return shell;
}

export function createShellManifest({
  html,
  routes,
  localeCodes,
  siteKey,
  artifactOrigin,
  shellVersion: configuredVersion,
  builtAt = new Date().toISOString(),
}) {
  const rawVersion = configuredVersion || `shell-${createHash("sha256").update(html).digest("hex").slice(0, 16)}`;
  const shellVersion = rawVersion.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 128);
  if (!VERSION_PATTERN.test(shellVersion)) throw new Error("The generated shell version is invalid.");

  const seedRoutes = routes.flatMap(({ path, lang, source }) => {
    const decision = classifyStorefrontRequest({
      target: path,
      method: "GET",
      localeCodes,
    });
    const route = decision.kind === "public-artifact" ? normalizePublicRoutePath(path) : null;
    const policySegments = route?.split("/").filter(Boolean) || [];
    const firstSegment = policySegments[0]?.toLowerCase();
    const localized = localeCodes.map((locale) => locale.toLowerCase()).includes(firstSegment);
    const policyRoute = localized ? `/${policySegments.slice(1).join("/")}` || "/" : route;
    if (source === "stable" && !CORE_STABLE_ARTIFACT_ROUTES.has(policyRoute)) return [];
    return route ? [{ route, locale: normalizeArtifactLocale(lang) }] : [];
  });
  const uniqueSeedRoutes = [...new Map(seedRoutes.map((seed) => [`${seed.locale}|${seed.route}`, seed])).values()]
    .sort((left, right) => `${left.locale}|${left.route}`.localeCompare(`${right.locale}|${right.route}`));
  const assets = extractShellAssets(html);
  const template = createShellTemplate(html, { artifactOrigin, shellVersion });
  const hashMaterial = JSON.stringify({ siteKey, shellVersion, template, assets, seedRoutes: uniqueSeedRoutes });

  return {
    schemaVersion: 1,
    artifactSchemaVersion: 1,
    siteKey,
    shellVersion,
    builtAt,
    contentHash: `sha256:${createHash("sha256").update(hashMaterial).digest("hex")}`,
    template,
    assets,
    seedRoutes: uniqueSeedRoutes,
  };
}

export async function publishShellManifest({
  manifest,
  artifactOrigin,
  signingSecret,
  fetchImpl = fetch,
  now = Date.now(),
  eventId = `shell-${manifest.shellVersion}-${randomUUID()}`,
}) {
  const body = JSON.stringify(manifest);
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${eventId}.${body}`)
    .digest("hex");
  const response = await fetchImpl(`${artifactOrigin}${ARTIFACT_API_PATH}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-superfunky-signature": signature,
      "x-superfunky-timestamp": timestamp,
      "x-superfunky-event-id": eventId,
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Artifact shell registration failed with HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export function artifactProxyRedirects(manifest, artifactOrigin) {
  const endpoint = `${artifactOrigin}${ARTIFACT_API_PATH}/artifact`;
  return manifest.seedRoutes.map(({ route, locale }) => {
    const query = new URLSearchParams({
      route,
      locale,
      shell: manifest.shellVersion,
    });
    return `${route}  ${endpoint}?${query}  200!`;
  });
}
