import { useEffect, useRef, useState } from "react";
import {
  validateContentRevision,
  validateStorefrontHydrationPayload,
  type ContentRevisionV1,
  type StorefrontHydrationPayloadV1,
} from "@funky/shared";

/** Client-side freshness layer for the generated Vite storefront.
 *
 * Production builds discover public CMS URLs and emit static HTML entry points. The
 * WordPress build webhook integration triggers those builds on debounced content changes
 * and on the configured periodic schedule. This stale-while-revalidate cache complements
 * that build-time layer for frequently changing commerce and community data:
 *
 *  1. Render instantly from the last-known-good response cached in `localStorage`.
 *  2. Kick off a background refetch immediately; swap in the fresh data when it
 *     resolves, with no loading spinner if a cached value was already shown.
 *  3. On any fetch failure, keep serving the stale cache rather than replacing usable
 *     content with an error.
 *
 * The cache remains a second, client-side layer of freshness on top of generated pages. */

export type IncrementalDataState<T> = {
  data: T | null;
  /** `true` until the first response (cached or network) has resolved. */
  isLoading: boolean;
  /** `true` while a background refetch is in flight after a stale cache hit. */
  isRevalidating: boolean;
  /** Set only when there is truly no data to show (no cache, and the network fetch
   * failed) — with a warm cache, fetch failures are swallowed and this stays `null`. */
  error: Error | null;
};

const memoryCache = new Map<string, unknown>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const artifactMetadata = new Map<string, ArtifactSeedMetadata>();
let revisionRequest: Promise<ContentRevisionV1> | null = null;
let revisionCheckedAt = 0;

type ArtifactSeedMetadata = {
  contentRevision: number;
  expiresAt: string;
  dependencies: string[];
};

function storageKeyFor(cacheKey: string): string {
  return `funkycommerce-isg-cache:${cacheKey}`;
}

function metadataKeyFor(storageKey: string): string {
  return storageKey.replace("funkycommerce-isg-cache:", "funkycommerce-isg-meta:");
}

function readPersistedCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writePersistedCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable — the in-memory cache still keeps this session fast.
  }
}

function readArtifactMetadata(storageKey: string): ArtifactSeedMetadata | null {
  const memory = artifactMetadata.get(storageKey);
  if (memory) return memory;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(metadataKeyFor(storageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ArtifactSeedMetadata>;
    if (
      !Number.isInteger(parsed.contentRevision)
      || typeof parsed.expiresAt !== "string"
      || !Array.isArray(parsed.dependencies)
      || !parsed.dependencies.every((dependency) => typeof dependency === "string")
    ) {
      return null;
    }
    const metadata = parsed as ArtifactSeedMetadata;
    artifactMetadata.set(storageKey, metadata);
    return metadata;
  } catch {
    return null;
  }
}

function writeArtifactMetadata(storageKey: string, metadata: ArtifactSeedMetadata): void {
  artifactMetadata.set(storageKey, metadata);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(metadataKeyFor(storageKey), JSON.stringify(metadata));
  } catch {
    // Artifact data remains valid in memory when browser storage is unavailable.
  }
}

function readCache<T>(storageKey: string): T | null {
  return (memoryCache.get(storageKey) as T | undefined) ?? readPersistedCache<T>(storageKey);
}

export function preloadIncrementalData<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const storageKey = storageKeyFor(cacheKey);
  const existing = inFlightRequests.get(storageKey) as Promise<T> | undefined;
  if (existing) return existing;

  const request = fetcher()
    .then((fresh) => {
      memoryCache.set(storageKey, fresh);
      writePersistedCache(storageKey, fresh);
      return fresh;
    })
    .finally(() => {
      inFlightRequests.delete(storageKey);
    });
  inFlightRequests.set(storageKey, request);
  return request;
}

export function seedIncrementalData<T>(cacheKey: string, value: T): void {
  const storageKey = storageKeyFor(cacheKey);
  memoryCache.set(storageKey, value);
}

export function invalidateIncrementalDataPrefix(cacheKeyPrefix: string): void {
  const storagePrefix = storageKeyFor(cacheKeyPrefix);
  for (const key of memoryCache.keys()) {
    if (key.startsWith(storagePrefix)) memoryCache.delete(key);
  }
  for (const key of artifactMetadata.keys()) {
    if (key.startsWith(storagePrefix)) artifactMetadata.delete(key);
  }
  if (typeof window === "undefined") return;
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith(storagePrefix) || key.startsWith(metadataKeyFor(storagePrefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // In-memory invalidation still prevents stale data in the active session.
  }
}

export function seedStorefrontHydration(input: unknown): StorefrontHydrationPayloadV1 | null {
  const result = validateStorefrontHydrationPayload(input);
  if (!result.ok) {
    console.error(
      "Storefront artifact hydration was rejected:",
      result.issues.map(({ path, message }) => `${path}: ${message}`).join("; "),
    );
    return null;
  }
  for (const entry of result.value.entries) {
    const compatible = entry.cacheKey.startsWith("artifact-route:v1:")
      || entry.cacheKey.startsWith("artifact-navigation:v1:")
      || entry.cacheKey.startsWith("navigation-data:v14:")
      || entry.cacheKey.startsWith("navigation-assistant:v2:")
      || entry.cacheKey.startsWith("storefront-route-registry:v6:")
      || entry.cacheKey.startsWith("commerce-data:v4:")
      || entry.cacheKey.startsWith("blog-data:v4:")
      || entry.cacheKey.startsWith("blog-data:summary:v1:")
      || entry.cacheKey.startsWith("community:v10:")
      || entry.cacheKey.startsWith("community:feed:v1:")
      || entry.cacheKey.startsWith("author:v2:")
      || entry.cacheKey.startsWith("page:/")
      || entry.cacheKey.startsWith("content-page-by-uri:v1:/")
      || entry.cacheKey.startsWith("content-node:v2:/")
      || entry.cacheKey.startsWith("home-page:v1:")
      || entry.cacheKey === "wordpress-theme-styles:v5";
    if (!compatible) continue;
    const storageKey = storageKeyFor(entry.cacheKey);
    memoryCache.set(storageKey, entry.value);
    writePersistedCache(storageKey, entry.value);
    writeArtifactMetadata(storageKey, {
      contentRevision: result.value.contentRevision,
      expiresAt: result.value.expiresAt,
      dependencies: entry.dependencies,
    });
  }
  return result.value;
}

export function prefetchIncrementalData<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = readCache<T>(storageKeyFor(cacheKey));
  return cached === null ? preloadIncrementalData(cacheKey, fetcher) : Promise.resolve(cached);
}

type KeyedIncrementalDataState<T> = IncrementalDataState<T> & {
  storageKey: string;
};

function initialState<T>(storageKey: string): KeyedIncrementalDataState<T> {
  const data = readCache<T>(storageKey);
  const metadata = data === null ? null : readArtifactMetadata(storageKey);
  const trustedAndCurrent = metadata !== null
    && metadata.contentRevision > 0
    && Date.parse(metadata.expiresAt) > Date.now();
  return {
    storageKey,
    data,
    isLoading: data === null,
    isRevalidating: data !== null && !trustedAndCurrent,
    error: null,
  };
}

async function latestContentRevision() {
  if (revisionRequest && Date.now() - revisionCheckedAt < 15_000) return revisionRequest;
  const endpoint = document.querySelector<HTMLMetaElement>(
    'meta[name="storefront-artifact-revision-endpoint"]',
  )?.content;
  if (!endpoint) return null;
  revisionCheckedAt = Date.now();
  revisionRequest = fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Artifact revision check failed with HTTP ${response.status}`);
      const result = validateContentRevision(await response.json());
      if (!result.ok) {
        throw new Error(result.issues.map(({ path, message }) => `${path}: ${message}`).join("; "));
      }
      return result.value;
    })
    .catch((error) => {
      revisionRequest = null;
      revisionCheckedAt = 0;
      throw error;
    });
  return revisionRequest;
}

async function shouldRefreshArtifactSeed(storageKey: string, metadata: ArtifactSeedMetadata): Promise<boolean> {
  if (metadata.contentRevision <= 0) return true;
  if (Date.parse(metadata.expiresAt) <= Date.now()) return true;
  const latest = await latestContentRevision();
  if (!latest || latest.revision <= metadata.contentRevision) return false;

  const exactlyNextRevision = latest.revision === metadata.contentRevision + 1;
  const affected = latest.dependencies.some((dependency) => metadata.dependencies.includes(dependency));
  if (exactlyNextRevision && !affected) {
    writeArtifactMetadata(storageKey, {
      ...metadata,
      contentRevision: latest.revision,
    });
    return false;
  }
  return true;
}

function waitForStorefrontIdle(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => resolve(), { timeout: 2_000 });
      } else {
        window.setTimeout(resolve, 0);
      }
    };

    if (document.documentElement.dataset.storefrontReady === "true"
      || document.querySelector('[data-storefront-ready="true"]')) {
      schedule();
      return;
    }
    window.addEventListener("funky:storefront-ready", schedule, { once: true });
  });
}

/** @param cacheKey Stable, unique key for this query (e.g. `product:${slug}`) —
 * used for both the in-memory and localStorage cache layers. */
export function useIncrementalData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  enabled = true,
): IncrementalDataState<T> {
  const storageKey = storageKeyFor(cacheKey);
  const [state, setState] = useState<KeyedIncrementalDataState<T>>(() => initialState<T>(storageKey));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const currentState = state.storageKey === storageKey ? state : initialState<T>(storageKey);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache<T>(storageKey);
    if (!enabled) {
      setState({
        storageKey,
        data: cached,
        isLoading: false,
        isRevalidating: false,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }
    const metadata = cached === null ? null : readArtifactMetadata(storageKey);
    const trustedAndCurrent = metadata !== null
      && metadata.contentRevision > 0
      && Date.parse(metadata.expiresAt) > Date.now();
    setState({
      storageKey,
      data: cached,
      isLoading: cached === null,
      isRevalidating: cached !== null && !trustedAndCurrent,
      error: null,
    });

    const refresh = async () => {
      if (cached !== null && metadata) {
        await waitForStorefrontIdle();
        if (!(await shouldRefreshArtifactSeed(storageKey, metadata))) return cached;
      }
      return preloadIncrementalData(cacheKey, fetcherRef.current);
    };

    refresh()
      .then((fresh) => {
        if (cancelled) return;
        setState({
          storageKey,
          data: fresh,
          isLoading: false,
          isRevalidating: false,
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          storageKey,
          data: cached,
          isLoading: false,
          isRevalidating: false,
          error: cached === null ? err : null,
        });
      });

    return () => {
      cancelled = true;
    };
    // Re-runs only when the query identity changes — `fetcherRef` keeps the latest
    // closure available without retriggering the effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, storageKey]);

  return {
    data: currentState.data,
    isLoading: currentState.isLoading,
    isRevalidating: currentState.isRevalidating,
    error: currentState.error,
  };
}
