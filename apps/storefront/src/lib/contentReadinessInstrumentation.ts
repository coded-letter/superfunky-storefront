/** Lightweight, dependency-free performance instrumentation for content readiness.
 *
 * Mirrors the `performance.mark("storefront:*")` convention already used for bootstrap
 * timing (see `main.tsx` and `App.tsx`): every mark is a no-op outside a `performance`-
 * capable runtime, so this module is safe to import from server-rendered code paths and
 * from `node:test` files alike. Counters are plain module state — intentionally simple,
 * mirroring the rest of the storefront's "lightweight" instrumentation rather than
 * introducing an analytics dependency. */

function mark(name: string): void {
  globalThis.performance?.mark?.(name);
}

function measure(name: string, startMark: string, endMark: string): void {
  try {
    globalThis.performance?.measure?.(name, startMark, endMark);
  } catch {
    // The start mark may be missing (e.g. swap skipped) — the measure is best-effort.
  }
}

/** Marks that a routed content lookup (page/post/product/taxonomy) began for `routeKey`
 * (typically the pathname). Safe to call repeatedly across client-side navigations —
 * each routeKey gets its own start mark so `markRouteDataReady` can measure it. */
export function markRouteRequestStart(): void {
  mark("storefront:route-request-start");
}

/** Marks that the routed content lookup for `routeKey` has resolved (found or not-found),
 * and records the elapsed wait as a `storefront:route-data-wait:<routeKey>` measure when
 * the matching start mark exists. */
export function markRouteDataReady(): void {
  mark("storefront:route-data-ready");
  measure("storefront:route-data-wait", "storefront:route-request-start", "storefront:route-data-ready");
}

let compatibilityRetryCount = 0;

/** Records one GraphQL compatibility-fallback retry (a query rejected for a schema
 * mismatch that triggers another attempt with a more compatible query). Returns the
 * updated running total so callers can log/report it without a second read. */
export function recordCompatibilityRetry(): number {
  compatibilityRetryCount += 1;
  mark("storefront:compatibility-retry");
  return compatibilityRetryCount;
}

/** Running count of compatibility-fallback retries recorded so far in this page lifetime. */
export function getCompatibilityRetryCount(): number {
  return compatibilityRetryCount;
}

/** Test-only: resets the compatibility retry counter to zero. */
export function resetCompatibilityRetryCountForTests(): void {
  compatibilityRetryCount = 0;
}
