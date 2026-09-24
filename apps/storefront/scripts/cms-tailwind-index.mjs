import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildTailwindContentSource,
  collectCmsTailwindClassesFromTokens,
  evaluateCmsClassToken,
  extractStoredCmsClassTokens,
} from "./cms-tailwind-content.mjs";

const INDEX_PATH = "/.well-known/funkycommerce-tailwind-index.json";
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_SOURCES = 5_000;
const MAX_DYNAMIC_CLASSES = 10_000;
const INVENTORY_PAGE_SIZE = 100;
const SOURCE_BATCH_SIZE = 10;
const EXTRACTION_REVISION = 2;
const REQUEST_TIMEOUT_MS = 60_000;
const TRANSIENT_RETRY_DELAY_MS = 500;
const REQUEST_COOLDOWN_MS = 250;
const SOURCE_KEY_PATTERN = /^[a-z0-9_-]+:[1-9]\d*$/;
const VERSION_PATTERN = /^[a-f0-9]{64}$/;
const EXCLUDED_SOURCE_TYPES = new Set(["attachment"]);

function validateHttpsUrl(value, label) {
  const url = new URL(value);
  const localHttp = url.protocol === "http:"
    && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL (or local HTTP URL).`);
  }
  return url;
}

function endpointUrl(baseUrl, path) {
  const base = validateHttpsUrl(baseUrl, "CMS_TAILWIND_SOURCE_API_URL");
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  base.search = "";
  base.hash = "";
  return base.href;
}

async function readBoundedJsonResponse(response, label, maxBytes = MAX_RESPONSE_BYTES) {
  const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`${label} exceeded the ${maxBytes}-byte response limit`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new Error(`${label} exceeded the ${maxBytes}-byte response limit`);
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

const sleep = (milliseconds) => new Promise((resolvePromise) => {
  setTimeout(resolvePromise, milliseconds);
});

export async function signedTailwindSourceRequest({
  apiUrl,
  path,
  payload,
  signingSecret,
  fetchImpl = fetch,
  now = Date.now(),
  eventId = `tailwind-${randomUUID()}`,
  sleepImpl = sleep,
}) {
  if (typeof signingSecret !== "string" || signingSecret.trim().length < 32) {
    throw new Error("STOREFRONT_ARTIFACT_SIGNING_SECRET must contain at least 32 characters.");
  }
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac("sha256", signingSecret.trim())
    .update(`${timestamp}.${eventId}.${body}`)
    .digest("hex");
  const url = endpointUrl(apiUrl, path);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-superfunky-event-id": eventId,
          "x-superfunky-signature": signature,
          "x-superfunky-timestamp": timestamp,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new Error(`${path} request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
      }
      if (attempt === 0) {
        await sleepImpl(TRANSIENT_RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`${path} request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (response.ok) return readBoundedJsonResponse(response, path);
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await sleepImpl(TRANSIENT_RETRY_DELAY_MS);
      continue;
    }
    const errorPayload = await readBoundedJsonResponse(response, path, 64 * 1024).catch(() => null);
    const detail = typeof errorPayload?.message === "string" ? `: ${errorPayload.message}` : "";
    throw new Error(`${path} returned HTTP ${response.status}${detail}`);
  }
  throw new Error(`${path} request failed`);
}

function validateInventoryPage(payload, expectedCursor) {
  if (
    !payload
    || payload.schemaVersion !== 1
    || payload.cursor !== expectedCursor
    || !Number.isInteger(payload.nextCursor)
    || payload.nextCursor < expectedCursor
    || typeof payload.hasMore !== "boolean"
    || !Array.isArray(payload.sources)
    || payload.sources.length > INVENTORY_PAGE_SIZE
  ) {
    throw new Error("Tailwind source inventory response is malformed.");
  }

  let previousId = expectedCursor;
  return {
    hasMore: payload.hasMore,
    nextCursor: payload.nextCursor,
    sources: payload.sources.map((source) => {
      if (
        !source
        || !SOURCE_KEY_PATTERN.test(source.key)
        || !Number.isInteger(source.id)
        || source.id <= previousId
        || source.key !== `${source.type}:${source.id}`
        || !/^[a-z0-9_-]+$/.test(source.type)
        || !VERSION_PATTERN.test(source.version)
      ) {
        throw new Error("Tailwind source inventory contains an invalid source.");
      }
      previousId = source.id;
      return {
        key: source.key,
        id: source.id,
        type: source.type,
        version: source.version,
      };
    }),
  };
}

export async function fetchTailwindSourceInventory(options) {
  const sources = [];
  let cursor = 0;
  let requestCount = 0;

  while (true) {
    const payload = await signedTailwindSourceRequest({
      ...options,
      path: "inventory",
      payload: { cursor, limit: INVENTORY_PAGE_SIZE },
      eventId: `tailwind-inventory-${cursor}-${randomUUID()}`,
    });
    requestCount += 1;
    const page = validateInventoryPage(payload, cursor);
    sources.push(...page.sources.filter(({ type }) => !EXCLUDED_SOURCE_TYPES.has(type)));
    if (sources.length > MAX_SOURCES) {
      throw new Error(`Tailwind source inventory exceeded ${MAX_SOURCES} sources.`);
    }
    if (!page.hasMore) return { sources, requestCount };
    if (!page.sources.length || page.nextCursor <= cursor) {
      throw new Error("Tailwind source inventory cursor did not advance.");
    }
    cursor = page.nextCursor;
    await (options.sleepImpl || sleep)(REQUEST_COOLDOWN_MS);
  }
}

function validateSourceBatch(payload, expectedSources) {
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.sources)) {
    throw new Error("Tailwind source batch response is malformed.");
  }
  if (payload.sources.length !== expectedSources.length) {
    throw new Error("A Tailwind source changed while the build was reading it.");
  }
  const expected = new Map(expectedSources.map((source) => [source.key, source]));
  const found = new Set();
  return payload.sources.map((source) => {
    const inventory = expected.get(source?.key);
    if (
      !inventory
      || found.has(source.key)
      || source.id !== inventory.id
      || source.type !== inventory.type
      || source.version !== inventory.version
      || typeof source.content !== "string"
      || typeof source.excerpt !== "string"
      || !Array.isArray(source.menuClasses)
      || source.menuClasses.some((token) => typeof token !== "string")
    ) {
      throw new Error(`Tailwind source batch contains an invalid or stale source: ${source?.key || "unknown"}.`);
    }
    found.add(source.key);
    return source;
  });
}

function sourceDynamicClasses(source) {
  const tokens = extractStoredCmsClassTokens([
    source.content,
    source.excerpt,
    `<div class="${source.menuClasses.join(" ")}"></div>`,
  ]);
  const dynamic = new Set();
  const rejected = [];
  for (const token of tokens) {
    const result = evaluateCmsClassToken(token);
    if (result.status === "dynamic") dynamic.add(token);
    if (result.status === "rejected") rejected.push({ token, reason: result.reason });
  }
  if (dynamic.size > 1_000) {
    throw new Error(`Tailwind source ${source.key} exceeded 1000 dynamic classes.`);
  }
  return {
    classes: [...dynamic].sort(),
    rejected,
  };
}

export async function fetchChangedTailwindSources({
  changedSources,
  sleepImpl = sleep,
  ...requestOptions
}) {
  const records = new Map();
  const rejected = [];
  let requestCount = 0;

  for (let index = 0; index < changedSources.length; index += SOURCE_BATCH_SIZE) {
    const batch = changedSources.slice(index, index + SOURCE_BATCH_SIZE);
    const payload = await signedTailwindSourceRequest({
      ...requestOptions,
      sleepImpl,
      path: "sources",
      payload: { ids: batch.map(({ id }) => id) },
      eventId: `tailwind-sources-${batch[0].id}-${randomUUID()}`,
    });
    requestCount += 1;
    for (const source of validateSourceBatch(payload, batch)) {
      const extracted = sourceDynamicClasses(source);
      records.set(source.key, {
        version: source.version,
        classes: extracted.classes,
        extractionRevision: EXTRACTION_REVISION,
      });
      rejected.push(...extracted.rejected.map((entry) => ({ ...entry, source: source.key })));
    }
    if (index + SOURCE_BATCH_SIZE < changedSources.length) {
      await sleepImpl(REQUEST_COOLDOWN_MS);
    }
  }
  return { records, rejected, requestCount };
}

function emptyIndex() {
  return {
    schemaVersion: 1,
    extractionRevision: EXTRACTION_REVISION,
    generatedAt: "1970-01-01T00:00:00.000Z",
    sourceCount: 0,
    classCount: 0,
    sha256: createHash("sha256").update("").digest("hex"),
    sources: {},
  };
}

async function readLocalBootstrapIndex(indexOutputPath) {
  let payload;
  try {
    payload = JSON.parse(await readFile(indexOutputPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(
      `Local Tailwind bootstrap index could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateTailwindSourceIndex(payload);
}

export function validateTailwindSourceIndex(payload) {
  if (
    !payload
    || payload.schemaVersion !== 1
    || (payload.extractionRevision !== undefined && (
      !Number.isInteger(payload.extractionRevision)
      || payload.extractionRevision < 1
      || payload.extractionRevision > EXTRACTION_REVISION
    ))
    || typeof payload.generatedAt !== "string"
    || !Number.isFinite(Date.parse(payload.generatedAt))
    || !payload.sources
    || typeof payload.sources !== "object"
    || Array.isArray(payload.sources)
  ) {
    throw new Error("Previous Tailwind source index is malformed.");
  }
  const entries = Object.entries(payload.sources);
  if (entries.length > MAX_SOURCES || payload.sourceCount !== entries.length) {
    throw new Error("Previous Tailwind source index has an invalid source count.");
  }
  const dynamic = new Set();
  const sources = {};
  const extractionRevision = payload.extractionRevision ?? 1;
  for (const [key, source] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (
      !SOURCE_KEY_PATTERN.test(key)
      || !source
      || !VERSION_PATTERN.test(source.version)
      || !Array.isArray(source.classes)
      || source.classes.length > 1_000
      || (
        source.extractionRevision !== undefined
        && (
          !Number.isInteger(source.extractionRevision)
          || source.extractionRevision < 1
          || source.extractionRevision > EXTRACTION_REVISION
        )
      )
    ) {
      throw new Error(`Previous Tailwind source index contains an invalid source: ${key}.`);
    }
    const classes = [...new Set(source.classes)];
    classes.sort();
    if (
      classes.length !== source.classes.length
      || classes.some((token, index) =>
        token !== source.classes[index] || evaluateCmsClassToken(token).status !== "dynamic")
    ) {
      throw new Error(`Previous Tailwind source index contains invalid classes for ${key}.`);
    }
    classes.forEach((token) => dynamic.add(token));
    sources[key] = {
      version: source.version,
      classes,
      extractionRevision: source.extractionRevision ?? extractionRevision,
    };
  }
  const classes = [...dynamic].sort();
  if (
    classes.length > MAX_DYNAMIC_CLASSES
    || payload.classCount !== classes.length
    || payload.sha256 !== createHash("sha256").update(classes.join("\n")).digest("hex")
  ) {
    throw new Error("Previous Tailwind source index digest or class count is invalid.");
  }
  return { ...payload, extractionRevision, sources };
}

export async function fetchPreviousTailwindSourceIndex({
  indexUrl,
  fetchImpl = fetch,
  allowBootstrap = false,
}) {
  const url = validateHttpsUrl(indexUrl, "Tailwind source index URL");
  const response = await fetchImpl(url.href, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404 && allowBootstrap) return emptyIndex();
  if (
    response.ok
    && allowBootstrap
    && (response.headers.get("content-type") || "").toLowerCase().includes("text/html")
  ) {
    return emptyIndex();
  }
  if (response.status === 404) {
    throw new Error("previous Tailwind source index is missing; enable CMS_TAILWIND_BOOTSTRAP for the first deployment");
  }
  if (!response.ok) throw new Error(`previous Tailwind source index returned HTTP ${response.status}`);
  return validateTailwindSourceIndex(
    await readBoundedJsonResponse(response, "previous Tailwind source index", MAX_INDEX_BYTES),
  );
}

function createIndex(sources, generatedAt) {
  const normalizedSources = {};
  const dynamic = new Set();
  for (const key of [...sources.keys()].sort()) {
    const source = sources.get(key);
    normalizedSources[key] = source;
    source.classes.forEach((token) => dynamic.add(token));
  }
  const classes = [...dynamic].sort();
  if (classes.length > MAX_DYNAMIC_CLASSES) {
    throw new Error(`CMS Tailwind dynamic class limit exceeded (${MAX_DYNAMIC_CLASSES}).`);
  }
  return {
    schemaVersion: 1,
    extractionRevision: EXTRACTION_REVISION,
    generatedAt: new Date(generatedAt).toISOString(),
    sourceCount: sources.size,
    classCount: classes.length,
    sha256: createHash("sha256").update(classes.join("\n")).digest("hex"),
    sources: normalizedSources,
  };
}

export async function buildIncrementalTailwindIndex({
  apiUrl,
  signingSecret,
  siteUrl,
  indexUrl = `${siteUrl?.replace(/\/+$/, "")}${INDEX_PATH}`,
  outputPath = resolve(".tailwind/cms-content.html"),
  indexOutputPath = resolve(`public${INDEX_PATH}`),
  fetchImpl = fetch,
  sleepImpl = sleep,
  generatedAt = Date.now(),
  allowBootstrap = false,
}) {
  if (!siteUrl) throw new Error("VITE_SITE_URL is required for incremental CMS Tailwind extraction.");
  const requestOptions = { apiUrl, signingSecret, fetchImpl, sleepImpl };
  let previous = await fetchPreviousTailwindSourceIndex({ indexUrl, fetchImpl, allowBootstrap });
  if (allowBootstrap && previous.generatedAt === "1970-01-01T00:00:00.000Z") {
    previous = await readLocalBootstrapIndex(indexOutputPath) || previous;
  }
  const inventoryResult = await fetchTailwindSourceInventory(requestOptions);
  const inventoryByKey = new Map(inventoryResult.sources.map((source) => [source.key, source]));
  const changed = inventoryResult.sources.filter(
    (source) => {
      const previousSource = previous.sources[source.key];
      return previousSource?.version !== source.version
        || previousSource.extractionRevision !== EXTRACTION_REVISION;
    },
  );
  const changedResult = await fetchChangedTailwindSources({
    changedSources: changed,
    ...requestOptions,
  });

  const nextSources = new Map();
  for (const source of inventoryResult.sources) {
    const record = changedResult.records.get(source.key) || previous.sources[source.key];
    if (!record || record.version !== source.version) {
      throw new Error(`Tailwind source ${source.key} has no current class record.`);
    }
    nextSources.set(source.key, record);
  }

  const index = createIndex(nextSources, generatedAt);
  const indexJson = `${JSON.stringify(index)}\n`;
  if (Buffer.byteLength(indexJson) > MAX_INDEX_BYTES) {
    throw new Error("CMS Tailwind source index exceeded the 2 MiB limit.");
  }
  const { classes, dynamic } = collectCmsTailwindClassesFromTokens(
    Object.values(index.sources).flatMap((source) => source.classes),
  );
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await mkdir(resolve(indexOutputPath, ".."), { recursive: true });
  await writeFile(outputPath, buildTailwindContentSource(classes), "utf8");
  await writeFile(indexOutputPath, indexJson, "utf8");

  return {
    classes,
    dynamic,
    index,
    rejected: changedResult.rejected,
    metrics: {
      inventoryRequests: inventoryResult.requestCount,
      sourceRequests: changedResult.requestCount,
      changedSources: changed.length,
      reusedSources: inventoryResult.sources.length - changed.length,
      deletedSources: Object.keys(previous.sources).filter((key) => !inventoryByKey.has(key)).length,
    },
  };
}
