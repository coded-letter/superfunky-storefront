import assert from "node:assert/strict";
import test from "node:test";
import { formatProductCardCurrency } from "./productCardCurrency.ts";

test("formats a backend product price range in the selected currency", () => {
  const product = formatProductCardCurrency(
    {
      id: "variable-product",
      name: "Variable product",
      priceLabel: "€10,00 – €20,00",
      priceRangeLabel: "€10,00 – €20,00",
    },
    (amount) => `PLN ${amount * 4}`,
  );

  assert.equal(product.priceRangeLabel, "PLN 40 – PLN 80");
});

test("preserves non-range product pricing", () => {
  const product = {
    id: "simple-product",
    name: "Simple product",
    priceLabel: "€10,00",
    priceAmount: 10,
  };

  assert.equal(formatProductCardCurrency(product, String), product);
});
