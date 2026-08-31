import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const outputDirectory = resolve("dist");
const manifest = JSON.parse(
  await readFile(resolve(outputDirectory, ".vite", "manifest.json"), "utf8"),
);
const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
if (!entry) throw new Error("Performance audit could not find the storefront entry chunk.");

const bootstrapChunks = [
  entry,
  ...(entry.dynamicImports || []).map((key) => {
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Performance audit could not resolve bootstrap import ${key}.`);
    return chunk;
  }),
];
const entryFiles = new Set(bootstrapChunks.flatMap((chunk) => [
  chunk.file,
  ...(chunk.imports || []).flatMap(resolveImportedFiles),
]));
const initialJavaScriptBytes = await totalBytes(entryFiles);
const initialJavaScriptGzipBytes = await totalGzipBytes(entryFiles);
const initialScriptCount = entryFiles.size;
const budgets = {
  // The synchronized EN/PL/JA archive, review, and inquiry catalogs add a small,
  // intentional baseline cost while keeping the first render translated offline.
  initialJavaScriptBytes: 1_050_000,
  initialJavaScriptGzipBytes: 310_000,
  initialScriptCount: 8,
};

if (initialJavaScriptBytes > budgets.initialJavaScriptBytes) {
  throw new Error(
    `Initial JavaScript is ${formatBytes(initialJavaScriptBytes)}; budget is ${formatBytes(budgets.initialJavaScriptBytes)}.`,
  );
}
if (initialScriptCount > budgets.initialScriptCount) {
  throw new Error(`Initial script count is ${initialScriptCount}; budget is ${budgets.initialScriptCount}.`);
}
if (initialJavaScriptGzipBytes > budgets.initialJavaScriptGzipBytes) {
  throw new Error(
    `Initial compressed JavaScript is ${formatBytes(initialJavaScriptGzipBytes)}; budget is ${formatBytes(budgets.initialJavaScriptGzipBytes)}.`,
  );
}

console.log(
  `[performance] initial JavaScript: ${formatBytes(initialJavaScriptBytes)} raw, `
    + `${formatBytes(initialJavaScriptGzipBytes)} gzip across ${initialScriptCount} files`,
);

function resolveImportedFiles(key) {
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Performance audit could not resolve manifest import ${key}.`);
  return [chunk.file, ...(chunk.imports || []).flatMap(resolveImportedFiles)];
}

async function totalBytes(files) {
  const sizes = await Promise.all(
    [...files].map(async (file) => (await stat(resolve(outputDirectory, file))).size),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

async function totalGzipBytes(files) {
  const sizes = await Promise.all(
    [...files].map(async (file) => gzipSync(await readFile(resolve(outputDirectory, file))).byteLength),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
