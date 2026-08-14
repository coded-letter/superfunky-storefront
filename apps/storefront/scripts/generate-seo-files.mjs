import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const defaultOutputDirectory = resolve(root, "dist");
const defaultRetryDelay = (attempt) => new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));

async function loadEnvironmentFile(filename) {
  try {
    const contents = await readFile(resolve(root, filename), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvironmentFile(".env");
await loadEnvironmentFile(".env.production");
await loadEnvironmentFile(".env.local");
await loadEnvironmentFile(".env.production.local");

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export async function fetchDocument(path, {
  backendOrigin,
  fetchImpl = fetch,
  maxAttempts = 3,
  retryDelay = defaultRetryDelay,
  timeoutMs = 15_000,
  warn = console.warn,
}) {
  let lastError;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsMade = attempt;
    try {
      const response = await fetchImpl(new URL(path, backendOrigin), {
        headers: { "User-Agent": "FunkyCommerce-Static-SEO/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        lastError = new Error(`${path} returned ${response.status}.`);
        if (!isRetryableStatus(response.status)) break;
      } else {
        return await response.text();
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) await retryDelay(attempt);
  }

  warn(
    `[seo-files] ${path} could not be mirrored after ${attemptsMade} attempt(s): `
      + `${errorMessage(lastError)} Keeping existing build output.`,
  );
  return null;
}

async function writeDocument(outputDirectory, filename, contents) {
  await writeFile(resolve(outputDirectory, filename), contents, "utf8");
  console.log(`[seo-files] wrote ${filename}`);
}

export function normalizeXmlDocument(contents, { rootPattern, closingPattern }) {
  if (typeof contents !== "string") return null;
  const declarationIndex = contents.indexOf("<?xml");
  const rootIndex = contents.search(rootPattern);
  if (rootIndex < 0) return null;

  const startIndex = declarationIndex >= 0 && declarationIndex < rootIndex ? declarationIndex : rootIndex;
  const document = contents.slice(startIndex).trim();
  if (
    !rootPattern.test(document)
    || !closingPattern.test(document)
    || /(?:<b>\s*)?(?:Warning|Notice|Deprecated|Fatal error)\b/i.test(document)
  ) {
    return null;
  }
  return `${document}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceXmlAttribute(element, attribute, value) {
  const pattern = new RegExp(`(\\s${attribute}\\s*=\\s*)(["'])[^"']*\\2`, "i");
  return pattern.test(element)
    ? element.replace(pattern, `$1"${value}"`)
    : element.replace(/\s*\/?>$/, ` ${attribute}="${value}" />`);
}

export function normalizeAtomDocument(contents, { backendOrigin, frontendOrigin }) {
  let document = normalizeXmlDocument(contents, {
    rootPattern: /<feed\b/i,
    closingPattern: /<\/feed>\s*$/i,
  });
  if (!document) return document;

  const firstEntryIndex = document.search(/<entry\b/i);
  const feedHeader = document.slice(0, firstEntryIndex === -1 ? document.length : firstEntryIndex);
  const feedId = feedHeader.match(/<id>\s*(https?:\/\/[^<\s]+)\s*<\/id>/i)?.[1];
  const publicOrigin = frontendOrigin
    ? new URL(frontendOrigin).origin
    : feedId
      ? new URL(feedId).origin
      : null;
  if (!publicOrigin) return document;

  const sourceOrigin = backendOrigin ? new URL(backendOrigin).origin : "";
  if (sourceOrigin && sourceOrigin !== publicOrigin) {
    document = document.replace(new RegExp(escapeRegExp(sourceOrigin), "g"), publicOrigin);
  }

  const title = document.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (title) {
    document = document.replace(
      /(<subtitle\b[^>]*>)\s*(<\/subtitle>)/i,
      `$1${title}$2`,
    );
  }

  document = document
    .replace(
      /<link\b(?=[^>]*\brel=(["'])alternate\1)[^>]*\/?>/i,
      (element) => replaceXmlAttribute(element, "href", `${publicOrigin}/`),
    )
    .replace(
      /<link\b(?=[^>]*\brel=(["'])self\1)[^>]*\/?>/i,
      (element) => replaceXmlAttribute(element, "href", `${publicOrigin}/atom.xml`),
    )
    .replace(
      /(<category\b[^>]*\bscheme\s*=\s*)(["'])\s*\2/gi,
      `$1"${publicOrigin}/"`,
    )
    .replace(
      /\s*<uri>\s*https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?(?:\/[^<]*)?\s*<\/uri>/gi,
      "",
    )
    .replace(
      /\s*<link\b(?=[^>]*\brel=(["'])replies\1)(?=[^>]*\btype=(["'])application\/atom\+xml\2)[^>]*\/?>/gi,
      "",
    );

  return document;
}

export function discoverWordPressSitemapChildren(contents, backendOrigin) {
  if (!/<sitemapindex\b/i.test(contents)) return [];

  const origin = new URL(backendOrigin).origin;
  const children = new Map();
  const locations = [...contents.matchAll(/<loc>\s*([^<]+?\.xml(?:\?[^<]*)?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&"));

  for (const location of locations) {
    let url;
    try {
      url = new URL(location, origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;

    const filename = url.pathname.slice(1);
    if (!/^wp-sitemap-[A-Za-z0-9_-]+\.xml$/.test(filename)) continue;
    children.set(`${url.pathname}${url.search}`, {
      filename,
      path: `${url.pathname}${url.search}`,
    });
  }

  return [...children.values()];
}

export async function generateSeoFiles({
  graphqlEndpoint = process.env.VITE_GRAPHQL_ENDPOINT?.trim(),
  siteUrl = process.env.VITE_SITE_URL?.trim()
    || process.env.URL?.trim()
    || process.env.DEPLOY_PRIME_URL?.trim(),
  outputDirectory = defaultOutputDirectory,
  fetchImpl = fetch,
  maxAttempts = 3,
  retryDelay = defaultRetryDelay,
  timeoutMs = 15_000,
  warn = console.warn,
} = {}) {
  if (!graphqlEndpoint) {
    warn("[seo-files] VITE_GRAPHQL_ENDPOINT is not configured; skipping backend SEO document mirroring.");
    return;
  }

  const backendOrigin = new URL(graphqlEndpoint).origin;
  const frontendOrigin = siteUrl ? new URL(siteUrl).origin : null;
  const fetchFromBackend = (path) => fetchDocument(path, {
    backendOrigin,
    fetchImpl,
    maxAttempts,
    retryDelay,
    timeoutMs,
    warn,
  });
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    rm(resolve(outputDirectory, "product.feed.xml"), { force: true }),
    rm(resolve(outputDirectory, "wp-sitemap.xml"), { force: true }),
  ]);

  const rss = await fetchFromBackend("/feed/");
  let normalizedAtom = null;
  for (const [index, path] of ["/atom.xml", "/feed/atom/"].entries()) {
    const atom = await fetchFromBackend(path);
    if (atom === null) continue;

    normalizedAtom = normalizeAtomDocument(atom, { backendOrigin, frontendOrigin });
    if (normalizedAtom) break;

    const hasFallback = index === 0;
    warn(
      `[seo-files] Atom response from ${path} was not a valid XML document; `
        + (hasFallback ? "trying the native Atom fallback." : "keeping existing build output."),
    );
  }
  const productFeed = await fetchFromBackend("/product-feed.xml");
  const sitemap = await fetchFromBackend("/wp-sitemap.xml");
  const normalizedRss = rss === null
    ? null
    : normalizeXmlDocument(rss, {
        rootPattern: /<rss\b/i,
        closingPattern: /<\/rss>\s*$/i,
      });
  const normalizedProductFeed = productFeed === null
    ? null
    : normalizeXmlDocument(productFeed, {
        rootPattern: /<rss\b/i,
        closingPattern: /<\/rss>\s*$/i,
      });
  const normalizedSitemap = sitemap === null
    ? null
    : normalizeXmlDocument(sitemap, {
        rootPattern: /<(?:sitemapindex|urlset)\b/i,
        closingPattern: /<\/(?:sitemapindex|urlset)>\s*$/i,
      });

  const writes = [];
  if (normalizedRss) {
    writes.push(
      writeDocument(outputDirectory, "feed.xml", normalizedRss),
      writeDocument(outputDirectory, "rss.xml", normalizedRss),
    );
  } else if (rss !== null) {
    warn("[seo-files] RSS response was not a valid XML document; keeping existing build output.");
  }
  if (normalizedAtom) {
    writes.push(writeDocument(outputDirectory, "atom.xml", normalizedAtom));
  }
  if (normalizedProductFeed) {
    writes.push(writeDocument(outputDirectory, "product-feed.xml", normalizedProductFeed));
  } else if (productFeed !== null) {
    warn("[seo-files] Product feed response was not a valid XML document; keeping existing build output.");
  }
  if (normalizedSitemap) {
    writes.push(writeDocument(outputDirectory, "wp-sitemap.xml", normalizedSitemap));
  } else if (sitemap !== null) {
    warn("[seo-files] WordPress sitemap response was not a valid XML document; keeping existing build output.");
  }
  await Promise.all(writes);

  if (!normalizedSitemap) return;
  for (const { filename, path } of discoverWordPressSitemapChildren(normalizedSitemap, backendOrigin)) {
    const child = await fetchFromBackend(path);
    const normalizedChild = child === null
      ? null
      : normalizeXmlDocument(child, {
          rootPattern: /<urlset\b/i,
          closingPattern: /<\/urlset>\s*$/i,
        });
    if (normalizedChild) await writeDocument(outputDirectory, filename, normalizedChild);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateSeoFiles().catch((error) => {
    console.error(`[seo-files] ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
