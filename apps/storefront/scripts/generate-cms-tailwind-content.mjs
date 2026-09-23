import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { loadEnv } from "vite";
import loadConfig from "tailwindcss/loadConfig.js";

import { buildTailwindContentSource, compileCmsTailwindClasses } from "./cms-tailwind-content.mjs";
import { fetchCmsTailwindDocuments } from "./cms-tailwind-query.mjs";

export { fetchCmsTailwindDocuments } from "./cms-tailwind-query.mjs";

function validateEndpoint(value, label = "VITE_GRAPHQL_ENDPOINT") {
  const endpoint = new URL(value);
  const localHttp = endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !localHttp) || endpoint.username || endpoint.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL (or local HTTP URL).`);
  }
  return endpoint.href;
}

export async function generateCmsTailwindContent({
  environment = { ...loadEnv("production", process.cwd(), ""), ...process.env },
  endpoint = environment.VITE_GRAPHQL_ENDPOINT?.trim(),
  outputPath = resolve(".tailwind/cms-content.html"),
  fetchImpl = fetch,
  offline = environment.CMS_TAILWIND_OFFLINE === "true",
  siteUrl = (environment.VITE_SITE_URL || environment.URL)?.trim(),
  config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url))),
} = {}) {
  // A failed extraction must not leave a previous site's inventory available to Vite.
  await rm(outputPath, { force: true });
  if (offline && environment.CMS_TAILWIND_REQUIRED === "true") throw new Error("Required CMS Tailwind extraction cannot run offline.");
  if (!offline && !endpoint) {
    throw new Error("CMS Tailwind requires VITE_GRAPHQL_ENDPOINT. Set CMS_TAILWIND_OFFLINE=true only for an explicit demo/offline build.");
  }
  const documents = offline ? [] : await fetchCmsTailwindDocuments(
    validateEndpoint(endpoint),
    fetchImpl,
    siteUrl ? new URL(validateEndpoint(siteUrl, "VITE_SITE_URL")).origin : undefined,
    (environment.STOREFRONT_EXPECTED_LOCALES || "").split(",").map((code) => code.trim()).filter(Boolean),
  );
  if (offline) console.warn("[cms-tailwind] explicit offline mode: generating baseline utilities without CMS content.");
  const result = await compileCmsTailwindClasses(documents, config);
  for (const { token, reason, source } of result.rejected) {
    console.warn(`[cms-tailwind] ${source}: ignored class ${JSON.stringify(token)}: ${reason}.`);
  }

  await mkdir(resolve(outputPath, ".."), { recursive: true });
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, buildTailwindContentSource(result.classes), "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  console.log(
    `[cms-tailwind] compiled ${result.classes.length} utilities from ${documents.length} CMS HTML fields`
      + ` (${result.cssBytes} CSS bytes); rejected ${result.rejected.length} token(s).`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--offline");
  Promise.resolve().then(() => {
    if (unknown.length) throw new Error(`Unknown CMS Tailwind option: ${unknown.join(", ")}. Use --offline only for demo builds.`);
    return generateCmsTailwindContent(process.argv.includes("--offline") ? { offline: true } : {});
  }).catch((error) => {
    console.error(`[cms-tailwind] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
