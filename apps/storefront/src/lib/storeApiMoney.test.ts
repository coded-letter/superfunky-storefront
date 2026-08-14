import assert from "node:assert/strict";
import test from "node:test";
import { formatStoreApiMoney, storeApiAmount } from "./storeApiMoney.ts";

test("formats Store API minor-unit prices without exposing HTML entities", () => {
  assert.equal(
    formatStoreApiMoney("2900", {
      currency_code: "PLN",
      currency_minor_unit: 2,
    }, "pl-PL"),
    "29,00\u00a0z\u0142",
  );
});

test("converts Store API minor-unit totals for every currency precision", () => {
  assert.equal(storeApiAmount("5000", { currency_code: "PLN", currency_minor_unit: 2 }), 50);
  assert.equal(storeApiAmount("500", { currency_code: "JPY", currency_minor_unit: 0 }), 500);
  assert.equal(storeApiAmount("12345", { currency_code: "BHD", currency_minor_unit: 3 }), 12.345);
});
