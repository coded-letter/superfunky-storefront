import assert from "node:assert/strict";
import test from "node:test";
import { resolveUiString } from "./uiStrings.ts";

test("UI strings prefer backend overrides and interpolate named values", () => {
  assert.equal(
    resolveUiString("order", { order: "Zamówienie {number}" }, { order: "Order {number}" }, { order: "Custom {number}" }, { number: 42 }),
    "Custom 42",
  );
});

test("UI strings fall back through English and finally the stable key", () => {
  assert.equal(resolveUiString("checkout", {}, { checkout: "Checkout" }), "Checkout");
  assert.equal(resolveUiString("missing.key", {}, {}), "missing.key");
});
