import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { splitCustomCss } from "../src/lib/customCssLayers.mjs";
import { localizeStaticFontAssets } from "./static-font-assets.mjs";

export async function writeStaticWordPressStyleAssets({
  prefixSections,
  suffixSections,
  customCss,
  outputDirectory,
  sourceHash,
}) {
  const layers = splitCustomCss(customCss);
  const criticalSections = [
    ...prefixSections,
    layers.critical,
    ...suffixSections,
  ].filter((section) => section.trim());
  const criticalSourceCss = criticalSections.join("\n");
  const deferredSourceCss = layers.deferred.trim()
    ? `/* storefront:deferred */\n${layers.deferred}`
    : "";
  const sourceCss = [criticalSourceCss, deferredSourceCss].filter(Boolean).join("\n");
  if (!sourceCss) return null;
  if (Buffer.byteLength(sourceCss, "utf8") > 1_500_000) {
    throw new Error("Combined WordPress static CSS exceeds the 1.5 MB build limit");
  }

  const localized = await localizeStaticFontAssets(sourceCss, {
    outputDirectory,
    preloadCss: criticalSourceCss,
  });
  const localizedLayers = splitCustomCss(localized.css);
  const criticalHash = createHash("sha256").update(localizedLayers.critical).digest("hex").slice(0, 16);
  const criticalFilename = `wordpress-static-${criticalHash}.css`;
  await mkdir(resolve(outputDirectory, "assets"), { recursive: true });
  await writeFile(
    resolve(outputDirectory, "assets", criticalFilename),
    `${localizedLayers.critical}\n`,
  );

  let deferredHref = "";
  if (localizedLayers.deferred.trim()) {
    const deferredHash = createHash("sha256").update(localizedLayers.deferred).digest("hex").slice(0, 16);
    const deferredFilename = `wordpress-deferred-${deferredHash}.css`;
    await writeFile(
      resolve(outputDirectory, "assets", deferredFilename),
      `${localizedLayers.deferred}\n`,
    );
    deferredHref = `/assets/${deferredFilename}`;
  }

  return {
    href: `/assets/${criticalFilename}`,
    deferredHref,
    sourceHash,
    criticalCss: layers.critical,
    fontAssets: localized.fontAssets,
    preloadAssets: localized.preloadAssets,
  };
}
