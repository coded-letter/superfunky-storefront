import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { performance } from "node:perf_hooks";

import {
  getCompatibilityRetryCount,
  markRouteDataReady,
  markRouteRequestStart,
  recordCompatibilityRetry,
  resetCompatibilityRetryCountForTests,
} from "./contentReadinessInstrumentation.ts";

function marksNamed(name: string) {
  return performance.getEntriesByName(name, "mark");
}

function measuresNamed(name: string) {
  return performance.getEntriesByName(name, "measure");
}

test("route request start/data-ready marks bracket a measurable wait for a given route", () => {
  performance.clearMarks("storefront:route-request-start");
  performance.clearMarks("storefront:route-data-ready");
  performance.clearMeasures("storefront:route-data-wait");

  markRouteRequestStart();
  markRouteDataReady();

  assert.equal(marksNamed("storefront:route-request-start").length, 1);
  assert.equal(marksNamed("storefront:route-data-ready").length, 1);
  const [waitMeasure] = measuresNamed("storefront:route-data-wait");
  assert.ok(waitMeasure, "expected a storefront:route-data-wait measure to be recorded");
  assert.ok(waitMeasure.duration >= 0);
});

test("marking route data ready without a matching start still records a ready mark without throwing", () => {
  performance.clearMarks("storefront:route-request-start");
  performance.clearMarks("storefront:route-data-ready");
  performance.clearMeasures("storefront:route-data-wait");

  assert.doesNotThrow(() => markRouteDataReady());
  assert.equal(marksNamed("storefront:route-data-ready").length, 1);
  assert.equal(measuresNamed("storefront:route-data-wait").length, 0);
});

test("compatibility retries accumulate in a running counter that tests can reset", () => {
  resetCompatibilityRetryCountForTests();
  assert.equal(getCompatibilityRetryCount(), 0);

  assert.equal(recordCompatibilityRetry(), 1);
  assert.equal(recordCompatibilityRetry(), 2);
  assert.equal(getCompatibilityRetryCount(), 2);

  resetCompatibilityRetryCountForTests();
  assert.equal(getCompatibilityRetryCount(), 0);
});

test("each compatibility retry is also marked for lightweight timeline inspection", () => {
  performance.clearMarks("storefront:compatibility-retry");
  resetCompatibilityRetryCountForTests();

  recordCompatibilityRetry();
  recordCompatibilityRetry();

  assert.equal(marksNamed("storefront:compatibility-retry").length, 2);
});

// The instrumentation calls into `commerceGraphqlCompatibility.ts` for the compatibility
// retry counter and into `main.tsx` / `state/navigationData.tsx` / `pages/ContentNodeRoute.tsx`
// for the marks — verify each call site is actually wired, following the source-assertion
// pattern already used by `scripts/bootstrap-performance.test.mjs`.
const compatibilitySource = readFileSync(new URL("./commerceGraphqlCompatibility.ts", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const navigationDataSource = readFileSync(new URL("../state/navigationData.tsx", import.meta.url), "utf8");
const contentNodeRouteSource = readFileSync(new URL("../pages/ContentNodeRoute.tsx", import.meta.url), "utf8");

test("the commerce compatibility fallback chain records a retry before advancing to the next query", () => {
  assert.match(
    compatibilitySource,
    /if \(!shouldRetry\(response\.errors\) \|\| index === queries\.length - 1\) break;\s*if \(!\(import\.meta\.env\?\.PROD \?\? false\)\) recordCompatibilityRetry\(\);/,
  );
});

test("the scoped and unscoped catalog compatibility fallbacks both record a retry", () => {
  assert.match(
    compatibilitySource,
    /if \(scopedCompatibleQuery && shouldRetry\(response\.errors\)\) \{\s*if \(!\(import\.meta\.env\?\.PROD \?\? false\)\) recordCompatibilityRetry\(\);/,
  );
  assert.match(
    compatibilitySource,
    /if \(isMissingProductRootSchemaError\(response\.errors\) \|\| shouldRetry\(response\.errors\)\) \{\s*if \(!\(import\.meta\.env\?\.PROD \?\? false\)\) recordCompatibilityRetry\(\);/,
  );
});

test("navigation readiness is marked once the provider's raw navigation data stops loading", () => {
  assert.match(
    navigationDataSource,
    /if \(!rawState\.isLoading && !navigationReadyMarked\.current\) \{\s*navigationReadyMarked\.current = true;\s*performance\.mark\("storefront:navigation-ready"\);/,
  );
});

test("routed content lookups mark request start on every uri change and data-ready once resolved", () => {
  assert.match(
    contentNodeRouteSource,
    /useEffect\(\(\) => \{\s*markRouteRequestStart\(\);\s*\}, \[uri\]\);/,
  );
  assert.match(
    contentNodeRouteSource,
    /useEffect\(\(\) => \{\s*if \(isRouteContentReady\) markRouteDataReady\(\);\s*\}, \[isRouteContentReady, uri\]\);/,
  );
});
