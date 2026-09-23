import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { cssClassNames, extractHtmlClassTokens } from "./cms-tailwind-content.mjs";

export async function auditCmsTailwind({
  outputDirectory = resolve("dist"),
  inventoryPath = resolve(".tailwind/cms-content.html"),
} = {}) {
  const manifest = JSON.parse(await readFile(resolve(outputDirectory, ".vite/manifest.json"), "utf8"));
  const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
  if (!entry) throw new Error("CMS Tailwind audit could not find the entry chunk.");
  const stylesheets = new Set();
  const visited = new Set();
  function collect(chunk) {
    if (visited.has(chunk)) return;
    visited.add(chunk);
    for (const css of chunk.css || []) stylesheets.add(css);
    for (const key of chunk.imports || []) {
      if (!manifest[key]) throw new Error(`CMS Tailwind audit could not resolve ${key}.`);
      collect(manifest[key]);
    }
  }
  collect(entry);
  const css = (await Promise.all([...stylesheets].map((path) => readFile(resolve(outputDirectory, path), "utf8")))).join("\n");
  const generated = cssClassNames(css);
  const expected = extractHtmlClassTokens(await readFile(inventoryPath, "utf8"));
  if (!expected.length) throw new Error("CMS Tailwind audit found an empty inventory.");
  const missing = expected.filter((token) => !generated.has(token));
  if (missing.length) throw new Error(`CMS Tailwind utilities missing from initial CSS: ${missing.join(", ")}`);
  console.log(`[cms-tailwind] verified ${expected.length} utilities in initial CSS (${gzipSync(css).byteLength} bytes gzip).`);
  return { classes: expected.length, stylesheets: [...stylesheets] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  auditCmsTailwind().catch((error) => {
    console.error(`[cms-tailwind] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
