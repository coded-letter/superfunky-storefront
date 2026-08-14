import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_PUBLIC_PATTERNS = [
  /data-rendered-wordpress-shortcode/i,
  /Searching WordPress/i,
  /Loading (?:WordPress|WooCommerce)/i,
  /No (?:WordPress|WooCommerce) (?:post|product|review)/i,
  /(?:WordPress|WooCommerce) has no published/i,
  /connected to your WordPress account/i,
  /(?:WordPress|WooCommerce) shortcode \[[^\]]+\] has no storefront renderer/i,
  /WooCommerce did not return/i,
  /WooCommerce could not/i,
];

export async function auditPublicCopy(distRoot) {
  const files = await collectFiles(distRoot);
  const violations = [];
  for (const file of files) {
    if (![".html", ".js", ".css", ".json", ".xml", ".txt"].includes(extname(file))) continue;
    const content = await readFile(file, "utf8");
    for (const pattern of FORBIDDEN_PUBLIC_PATTERNS) {
      if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
    }
  }
  return violations;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return nested.flat();
}

if (process.argv[1]?.endsWith("audit-public-copy.mjs")) {
  const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
  const violations = await auditPublicCopy(distRoot);
  if (violations.length) {
    console.error(`[public-copy] branded public copy found:\n${violations.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("[public-copy] production assets contain no disallowed public branding.");
  }
}
