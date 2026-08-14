import assert from "node:assert/strict";
import test from "node:test";
import { hasProductCardPrice } from "./productCardPrice.ts";

test("recognizes explicit zero as a valid product price", () => {
  assert.equal(hasProductCardPrice({ priceAmount: 0, priceLabel: "" }), true);
});

test("recognizes numeric, range, variation, and legacy label prices", () => {
  assert.equal(hasProductCardPrice({ priceAmount: 12 }), true);
  assert.equal(hasProductCardPrice({ priceRangeLabel: "$12 - $18" }), true);
  assert.equal(hasProductCardPrice({ variationPriceAmounts: [0, 10] }), true);
  assert.equal(hasProductCardPrice({ priceLabel: "$12.00" }), true);
});

test("rejects products whose price data is absent or invalid", () => {
  assert.equal(hasProductCardPrice({ priceLabel: "  " }), false);
  assert.equal(hasProductCardPrice({ priceAmount: Number.NaN, priceLabel: "" }), false);
  assert.equal(hasProductCardPrice({ priceAmount: -1, priceLabel: "" }), false);
});
