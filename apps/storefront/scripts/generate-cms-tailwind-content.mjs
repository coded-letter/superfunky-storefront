import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

import {
  buildTailwindContentSource,
  collectCmsTailwindClassesFromTokens,
} from "./cms-tailwind-content.mjs";
import { buildIncrementalTailwindIndex } from "./cms-tailwind-index.mjs";

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_MANIFEST_CLASSES = 10_000;
const MANIFEST_TIMEOUT_MS = 5_000;
const viteEnvironment = loadEnv("production", process.cwd(), "");

function validateManifestUrl(value) {
  const manifestUrl = new URL(value);
  const localHttp = manifestUrl.protocol === "http:"
    && ["127.0.0.1", "localhost", "::1"].includes(manifestUrl.hostname);
  if ((manifestUrl.protocol !== "https:" && !localHttp) || manifestUrl.username || manifestUrl.password) {
    throw new Error("VITE_CMS_TAILWIND_MANIFEST_URL must be a credential-free HTTPS URL (or local HTTP URL).");
  }
  return manifestUrl.href;
}

export function validateCmsTailwindManifest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("CMS Tailwind manifest must be a JSON object.");
  }
  if (payload.schemaVersion !== 1) {
    throw new Error("CMS Tailwind manifest uses an unsupported schema version.");
  }
  if (payload.complete !== true) {
    throw new Error("CMS Tailwind manifest is not complete.");
  }
  if (!Number.isInteger(payload.contentRevision) || payload.contentRevision < 1) {
    throw new Error("CMS Tailwind manifest contentRevision must be a positive integer.");
  }
  if (typeof payload.generatedAt !== "string" || !Number.isFinite(Date.parse(payload.generatedAt))) {
    throw new Error("CMS Tailwind manifest generatedAt must be an ISO timestamp.");
  }
  if (!Number.isInteger(payload.sourceCount) || payload.sourceCount < 0) {
    throw new Error("CMS Tailwind manifest sourceCount must be a non-negative integer.");
  }
  if (!Array.isArray(payload.classes) || payload.classes.length > MAX_MANIFEST_CLASSES) {
    throw new Error(`CMS Tailwind manifest must contain at most ${MAX_MANIFEST_CLASSES} classes.`);
  }
  if (payload.classCount !== payload.classes.length) {
    throw new Error("CMS Tailwind manifest classCount does not match its classes.");
  }

  let previous = "";
  for (const token of payload.classes) {
    if (
      typeof token !== "string"
      || !token
      || token.length > 160
      || !/^[\x21-\x7e]+$/.test(token)
      || (previous && previous >= token)
    ) {
      throw new Error("CMS Tailwind manifest classes must be unique, sorted, bounded printable tokens.");
    }
    previous = token;
  }

  const digest = createHash("sha256").update(payload.classes.join("\n")).digest("hex");
  if (typeof payload.sha256 !== "string" || payload.sha256 !== digest) {
    throw new Error("CMS Tailwind manifest SHA-256 digest is invalid.");
  }
  return {
    schemaVersion: payload.schemaVersion,
    complete: payload.complete,
    contentRevision: payload.contentRevision,
    generatedAt: payload.generatedAt,
    sourceCount: payload.sourceCount,
    classCount: payload.classCount,
    sha256: payload.sha256,
    classes: payload.classes,
  };
}

export async function fetchCmsTailwindManifest(manifestUrl, fetchImpl = fetch) {
  const response = await fetchImpl(validateManifestUrl(manifestUrl), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`static manifest returned HTTP ${response.status}`);

  const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MANIFEST_BYTES) {
    throw new Error("static manifest exceeded the 1 MiB download limit");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error("static manifest exceeded the 1 MiB download limit");
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("static manifest was not valid JSON");
  }
  return validateCmsTailwindManifest(payload);
}

export async function generateCmsTailwindContent({
  sourceApiUrl = (
    process.env.CMS_TAILWIND_SOURCE_API_URL
    || viteEnvironment.CMS_TAILWIND_SOURCE_API_URL
  )?.trim(),
  signingSecret = process.env.STOREFRONT_ARTIFACT_SIGNING_SECRET?.trim(),
  siteUrl = (
    process.env.VITE_SITE_URL
    || viteEnvironment.VITE_SITE_URL
  )?.trim(),
  allowBootstrap = (
    process.env.CMS_TAILWIND_BOOTSTRAP
    || viteEnvironment.CMS_TAILWIND_BOOTSTRAP
  ) === "true",
  manifestUrl = (
    process.env.VITE_CMS_TAILWIND_MANIFEST_URL
    || viteEnvironment.VITE_CMS_TAILWIND_MANIFEST_URL
  )?.trim(),
  outputPath = resolve(".tailwind/cms-content.html"),
  indexOutputPath = resolve("public/.well-known/funkycommerce-tailwind-index.json"),
  fetchImpl = fetch,
  requireManifest = Boolean(manifestUrl),
  useManifest = true,
} = {}) {
  if (useManifest && sourceApiUrl && manifestUrl) {
    throw new Error("Configure CMS_TAILWIND_SOURCE_API_URL or VITE_CMS_TAILWIND_MANIFEST_URL, not both.");
  }
  if (useManifest && sourceApiUrl) {
    const result = await buildIncrementalTailwindIndex({
      apiUrl: sourceApiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      fetchImpl,
      allowBootstrap,
    });
    for (const { source, token, reason } of result.rejected) {
      console.warn(`[cms-tailwind] ignored "${token}" from ${source}: ${reason}.`);
    }
    console.log(
      `[cms-tailwind] generated ${result.classes.length} utilities from ${result.index.sourceCount} indexed source(s)`
      + `; ${result.metrics.changedSources} changed, ${result.metrics.reusedSources} reused,`
      + ` ${result.metrics.deletedSources} deleted; ${result.metrics.inventoryRequests + result.metrics.sourceRequests} CMS request(s).`,
    );
    return { ...result, manifest: null };
  }

  let manifest = null;
  if (useManifest && manifestUrl) {
    try {
      manifest = await fetchCmsTailwindManifest(manifestUrl, fetchImpl);
    } catch (error) {
      if (requireManifest) throw error;
      console.warn(
        `[cms-tailwind] ${error instanceof Error ? error.message : String(error)}; using the stable contract only.`,
      );
    }
  } else if (useManifest && requireManifest) {
    throw new Error("VITE_CMS_TAILWIND_MANIFEST_URL is required but not configured.");
  }

  const { classes, dynamic, rejected } = collectCmsTailwindClassesFromTokens(manifest?.classes || []);
  for (const { token, reason } of rejected) {
    console.warn(`[cms-tailwind] ignored manifest class "${token}": ${reason}.`);
  }

  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, buildTailwindContentSource(classes), "utf8");
  console.log(
    `[cms-tailwind] generated ${classes.length} utilities`
      + (manifest
        ? ` from static manifest revision ${manifest.contentRevision} (${dynamic.length} CMS-specific)`
        : " from the stable local contract without a CMS request")
      + (rejected.length ? `; rejected ${rejected.length} unsupported token(s).` : "."),
  );
  return { classes, dynamic, rejected, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateCmsTailwindContent({
    useManifest: !process.argv.includes("--contract-only"),
  }).catch((error) => {
    console.error(`[cms-tailwind] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
