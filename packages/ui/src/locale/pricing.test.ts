import assert from "node:assert/strict";
import { test } from "node:test";
import { CURRENCY_OPTIONS } from "./options.ts";
import { calculateDiscountPercent, formatCurrencyAmount, parseLocalizedPrice } from "./pricing.ts";

test("calculates a rounded percentage discount from numeric prices", () => {
  assert.equal(calculateDiscountPercent(79, 95), 17);
});

test("calculates a percentage discount from localized display prices", () => {
  assert.equal(calculateDiscountPercent("79,00 zł", "95,00 zł"), 17);
  assert.equal(calculateDiscountPercent("$1,049.00", "$1,299.00"), 19);
});

test("rejects invalid and non-discounted price pairs", () => {
  assert.equal(calculateDiscountPercent(95, 79), null);
  assert.equal(calculateDiscountPercent(79, 79), null);
  assert.equal(calculateDiscountPercent(undefined, 95), null);
  assert.equal(calculateDiscountPercent("Price unavailable", "95,00 zł"), null);
});

test("continues to parse common localized price formats", () => {
  assert.equal(parseLocalizedPrice("€1.299,95"), 1299.95);
  assert.equal(parseLocalizedPrice("1,299.95 USD"), 1299.95);
});

test("includes Bitcoin and Ethereum in the fallback currency catalog", () => {
  assert.deepEqual(
    CURRENCY_OPTIONS
      .filter(({ code }) => code === "BTC" || code === "ETH")
      .map(({ code, label, symbol }) => ({ code, label, symbol })),
    [
      { code: "BTC", label: "Bitcoin", symbol: "₿" },
      { code: "ETH", label: "Ethereum", symbol: "Ξ" },
    ],
  );
});

test("formats Bitcoin and Ethereum with crypto precision and symbols", () => {
  assert.equal(formatCurrencyAmount(0.00001234, "BTC", "BTC", "en"), "₿\u202F0.00001234");
  assert.equal(formatCurrencyAmount(0.1234567, "ETH", "ETH", "en"), "⟠\u202F0.123457");
});
