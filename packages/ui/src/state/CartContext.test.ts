import assert from "node:assert/strict";
import test from "node:test";
import { mergeCartLineItemsByMaxQuantity } from "./cartMerge.ts";

test("merges cart items atomically using the highest quantity", () => {
  const merged = mergeCartLineItemsByMaxQuantity(
    [
      {
        id: "sku-1",
        name: "Alpha",
        priceLabel: "€10",
        quantity: 1,
      },
    ],
    [
      {
        id: "sku-1",
        name: "Alpha",
        priceLabel: "€10",
        quantity: 3,
      },
      {
        id: "sku-2",
        name: "Beta",
        priceLabel: "€20",
        quantity: 2,
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === "sku-1")?.quantity, 3);
  assert.equal(merged.find((item) => item.id === "sku-2")?.quantity, 2);
});

test("max-quantity merges are idempotent", () => {
  const initial = mergeCartLineItemsByMaxQuantity([], [
    {
      id: "sku-3",
      name: "Gamma",
      priceLabel: "€30",
      quantity: 4,
    },
  ]);
  const mergedAgain = mergeCartLineItemsByMaxQuantity(initial, [
    {
      id: "sku-3",
      name: "Gamma",
      priceLabel: "€30",
      quantity: 2,
    },
  ]);

  assert.equal(mergedAgain.length, 1);
  assert.equal(mergedAgain[0]?.quantity, 4);
});
