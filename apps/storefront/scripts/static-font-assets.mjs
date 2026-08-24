import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const FONT_URL_PATTERN = /url\(\s*(["']?)(https?:\/\/[^"'()]+)\1\s*\)/gi;
const FONT_FACE_PATTERN = /@font-face\s*\{([^}]*)\}/gi;
const MAX_FONT_COUNT = 24;
const MAX_FONT_BYTES = 512_000;
const MAX_TOTAL_FONT_BYTES = 2_000_000;
const MAX_PRELOAD_COUNT = 2;

function fontFormat(bytes) {
  const prefix = Buffer.from(bytes).subarray(0, 4);
  const magic = prefix.toString("ascii");
  if (magic === "wOF2") return { extension: "woff2", contentType: "font/woff2" };
  if (magic === "wOFF") return { extension: "woff", contentType: "font/woff" };
  if (magic === "OTTO") return { extension: "otf", contentType: "font/otf" };
  if (prefix.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) {
    return { extension: "ttf", contentType: "font/ttf" };
  }
  throw new Error("WordPress font asset is not a valid WOFF, WOFF2, OTF, or TTF file");
}

function declaration(block, property) {
  return block.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"))?.[1].trim() || "";
}

function defaultFacePreloads(css, fontAssets) {
  const available = new Map(fontAssets.map((asset) => [asset.href, asset]));
  const preloads = [];
  const families = new Set();
  for (const match of css.matchAll(FONT_FACE_PATTERN)) {
    const block = match[1];
    const family = declaration(block, "font-family").replace(/^["']|["']$/g, "").toLowerCase();
    const style = declaration(block, "font-style").toLowerCase() || "normal";
    const weight = declaration(block, "font-weight").toLowerCase() || "400";
    const href = block.match(/url\(\s*(["']?)(\/assets\/fonts\/[^"'()]+)\1\s*\)/i)?.[2];
    if (!href || !available.has(href) || families.has(family)) continue;
    if (style !== "normal" || !["400", "normal"].includes(weight)) continue;
    families.add(family);
    preloads.push(available.get(href));
  }
  return preloads
    .sort((left, right) => left.bytes - right.bytes)
    .slice(0, MAX_PRELOAD_COUNT);
}

export async function localizeStaticFontAssets(
  css,
  { outputDirectory, fetchImpl = fetch } = {},
) {
  if (!outputDirectory) throw new Error("A static font output directory is required");
  const fontFaceBlocks = [...css.matchAll(FONT_FACE_PATTERN)].map((match) => match[1]);
  const sourceUrls = [...new Set(fontFaceBlocks.flatMap((block) =>
    [...block.matchAll(FONT_URL_PATTERN)].map((match) => match[2])
  ))];
  if (sourceUrls.length > MAX_FONT_COUNT) {
    throw new Error(`Combined WordPress CSS references more than ${MAX_FONT_COUNT} remote font assets`);
  }
  if (!sourceUrls.length) return { css, fontAssets: [], preloadAssets: [] };

  const replacements = new Map();
  const fontAssets = [];
  let totalBytes = 0;
  await mkdir(resolve(outputDirectory, "assets", "fonts"), { recursive: true });

  for (const sourceUrl of sourceUrls) {
    const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`WordPress font request failed with status ${response.status}: ${sourceUrl}`);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FONT_BYTES) {
      throw new Error(`WordPress font exceeds the ${MAX_FONT_BYTES} byte build limit: ${sourceUrl}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_FONT_BYTES) {
      throw new Error(`WordPress font exceeds the ${MAX_FONT_BYTES} byte build limit: ${sourceUrl}`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_FONT_BYTES) {
      throw new Error(`Combined WordPress fonts exceed the ${MAX_TOTAL_FONT_BYTES} byte build limit`);
    }
    const format = fontFormat(bytes);
    const contentHash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
    const filename = `font-${contentHash}.${format.extension}`;
    const href = `/assets/fonts/${filename}`;
    await writeFile(resolve(outputDirectory, "assets", "fonts", filename), bytes);
    replacements.set(sourceUrl, href);
    fontAssets.push({ href, contentType: format.contentType, bytes: bytes.byteLength });
  }

  const localizedCss = css.replace(FONT_URL_PATTERN, (match, quote, sourceUrl) => {
    const href = replacements.get(sourceUrl);
    return href ? `url(${quote}${href}${quote})` : match;
  });
  return {
    css: localizedCss,
    fontAssets,
    preloadAssets: defaultFacePreloads(localizedCss, fontAssets),
  };
}
