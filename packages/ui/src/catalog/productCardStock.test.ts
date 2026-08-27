import assert from "node:assert/strict";
import test from "node:test";
import { isOutOfStockVariableProduct, shouldShowProductLearnMore } from "./productCardCta.ts";

test("an explicitly out-of-stock variable product uses Learn more without loaded variations", () => {
  const product = {
    productType: "variable" as const,
    inStock: false,
  };

  assert.equal(isOutOfStockVariableProduct(product), true);
  assert.equal(shouldShowProductLearnMore(product, true), true);
});

test("a variable product with no purchasable variations uses Learn more", () => {
  const product = {
    productType: "variable" as const,
    variations: [
      { inStock: false },
      { inStock: false },
    ],
  };

  assert.equal(isOutOfStockVariableProduct(product), true);
  assert.equal(shouldShowProductLearnMore(product, true), true);
});

test("an in-stock variable product keeps the options CTA", () => {
  const product = {
    productType: "variable" as const,
    inStock: true,
    variations: [{ inStock: true }],
  };

  assert.equal(isOutOfStockVariableProduct(product), false);
  assert.equal(shouldShowProductLearnMore(product, true), false);
});

test("external and grouped products retain their dedicated CTAs", () => {
  assert.equal(shouldShowProductLearnMore({ productType: "external" }, false), false);
  assert.equal(shouldShowProductLearnMore({ productType: "grouped" }, false), false);
});
