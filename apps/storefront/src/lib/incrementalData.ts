import { useEffect, useRef, useState } from "react";

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

function storageKeyFor(cacheKey: string): string {
  return `funkycommerce-isg-cache:${cacheKey}`;
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

export function prefetchIncrementalData<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = readCache<T>(storageKeyFor(cacheKey));
  return cached === null ? preloadIncrementalData(cacheKey, fetcher) : Promise.resolve(cached);
}

type KeyedIncrementalDataState<T> = IncrementalDataState<T> & {
  storageKey: string;
};

function initialState<T>(storageKey: string): KeyedIncrementalDataState<T> {
  const data = readCache<T>(storageKey);
  return {
    storageKey,
    data,
    isLoading: data === null,
    isRevalidating: data !== null,
    error: null,
  };
}

/** @param cacheKey Stable, unique key for this query (e.g. `product:${slug}`) —
 * used for both the in-memory and localStorage cache layers. */
export function useIncrementalData<T>(cacheKey: string, fetcher: () => Promise<T>): IncrementalDataState<T> {
  const storageKey = storageKeyFor(cacheKey);
  const [state, setState] = useState<KeyedIncrementalDataState<T>>(() => initialState<T>(storageKey));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const currentState = state.storageKey === storageKey ? state : initialState<T>(storageKey);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache<T>(storageKey);
    setState({
      storageKey,
      data: cached,
      isLoading: cached === null,
      isRevalidating: cached !== null,
      error: null,
    });

    preloadIncrementalData(cacheKey, fetcherRef.current)
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
  }, [cacheKey, storageKey]);

  return {
    data: currentState.data,
    isLoading: currentState.isLoading,
    isRevalidating: currentState.isRevalidating,
    error: currentState.error,
  };
}
