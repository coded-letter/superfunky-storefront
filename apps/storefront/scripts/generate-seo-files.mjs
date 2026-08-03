import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "dist");

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

const graphqlEndpoint = process.env.VITE_GRAPHQL_ENDPOINT?.trim();
if (!graphqlEndpoint) {
  console.warn("[seo-files] VITE_GRAPHQL_ENDPOINT is not configured; skipping backend SEO document mirroring.");
  process.exit(0);
}

const backendOrigin = new URL(graphqlEndpoint).origin;
await mkdir(outputDirectory, { recursive: true });

async function fetchDocument(path, optional = false) {
  const response = await fetch(new URL(path, backendOrigin), {
    headers: { "User-Agent": "FunkyCommerce-Static-SEO/1.0" },
    redirect: "follow",
  });
  if (optional && (response.status === 404 || response.status === 503)) return null;
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}.`);
  }
  return response.text();
}

async function writeDocument(filename, contents) {
  await writeFile(resolve(outputDirectory, filename), contents, "utf8");
  console.log(`[seo-files] wrote ${filename}`);
}

const rss = await fetchDocument("/feed/", true);
const atom = await fetchDocument("/feed/atom/", true);
const productFeed = await fetchDocument("/feed/products/", true);
const robots = await fetchDocument("/robots.txt");
const sitemap = await fetchDocument("/wp-sitemap.xml", true);

const writes = [writeDocument("robots.txt", robots)];
if (rss !== null) writes.push(writeDocument("feed.xml", rss), writeDocument("rss.xml", rss));
if (atom !== null) writes.push(writeDocument("atom.xml", atom));
if (productFeed !== null) {
  writes.push(writeDocument("product.feed.xml", productFeed), writeDocument("product-feed.xml", productFeed));
}
if (sitemap !== null) {
  writes.push(writeDocument("sitemap.xml", sitemap), writeDocument("wp-sitemap.xml", sitemap));
}
await Promise.all(writes);

const sitemapLocations = sitemap === null ? [] : [...sitemap.matchAll(/<loc>\s*([^<]+?\.xml(?:\?[^<]*)?)\s*<\/loc>/gi)]
  .map((match) => match[1].replace(/&amp;/g, "&"));

for (const location of sitemapLocations) {
  const url = new URL(location, backendOrigin);
  const filename = url.pathname.split("/").filter(Boolean).pop();
  if (!filename || !/^wp-sitemap-[A-Za-z0-9_-]+\.xml$/.test(filename)) continue;
  const child = await fetchDocument(`${url.pathname}${url.search}`);
  await writeDocument(filename, child);
}

for (const filename of [
  "llms.txt",
  "llms-full.txt",
  "ai-brand-voice.txt",
  "ai-products.jsonld",
  "ai-ranking-signals.txt",
  "ai-conversational-faq.json",
]) {
  const contents = await fetchDocument(`/${filename}`, true);
  if (contents !== null) await writeDocument(filename, contents);
}
