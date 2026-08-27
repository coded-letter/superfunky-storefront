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
  assert.equal(product.priceLabel, "PLN 40 – PLN 80");
});

test("formats simple, sale, and variation labels in the selected currency", () => {
  const product = {
    id: "priced-product",
    name: "Priced product",
    priceLabel: "€10,00",
    priceAmount: 10,
    compareAtPriceLabel: "€12,00",
    compareAtPriceAmount: 12,
    variations: [{
      id: "variation",
      attributes: {},
      priceLabel: "€11,00",
      priceAmount: 11,
      inStock: true,
    }],
  };
  const formatted = formatProductCardCurrency(product, (amount) => `PLN ${amount * 4}`);

  assert.equal(formatted.priceLabel, "PLN 40");
  assert.equal(formatted.compareAtPriceLabel, "PLN 48");
  assert.equal(formatted.variations?.[0].priceLabel, "PLN 44");
});
