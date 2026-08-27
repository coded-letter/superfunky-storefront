import assert from "node:assert/strict";
import test from "node:test";
import { matchesStorefrontFallbackPath } from "./routePathMatching.ts";

test("matches localized fallback routes regardless of trailing slash", () => {
  assert.equal(matchesStorefrontFallbackPath("/order-success/", "/order-success"), true);
  assert.equal(matchesStorefrontFallbackPath("/pl/order-success", "/order-success", "pl"), true);
  assert.equal(matchesStorefrontFallbackPath("/pl/order-success/", "/order-success", "pl"), true);
});

test("does not treat a configured localized slug as the fallback route", () => {
  assert.equal(matchesStorefrontFallbackPath("/pl/zamowienie-otrzymane/", "/order-success", "pl"), false);
});
