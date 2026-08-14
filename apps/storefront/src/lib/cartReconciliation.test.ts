import assert from "node:assert/strict";
import test from "node:test";
import { planCartReconciliation, type ResolvedCartLine } from "./cartReconciliation.ts";
import type { StoreApiCart, StoreApiCartItem } from "./wcStoreApi.ts";

const totals: StoreApiCart["totals"] = {
  currency_code: "USD",
  currency_symbol: "$",
  currency_minor_unit: 2,
  currency_decimal_separator: ".",
  currency_thousand_separator: ",",
  currency_prefix: "$",
  currency_suffix: "",
  total_price: "0",
};

function item(key: string, id: number, quantity: number, productId?: number): StoreApiCartItem {
  return {
    key,
    id,
    quantity,
    product_id: productId,
    name: key,
    sku: "",
    price: "1000",
    images: [],
  };
}

test("updates quantities in place so cart-session coupons and shipping survive", () => {
  const cart: StoreApiCart = {
    items: [item("line-1", 42, 1)],
    coupons: [{ code: "SAVE10", label: "SAVE10" }],
    totals,
  };
  const desired: ResolvedCartLine[] = [{ productId: 42, variationId: null, quantity: 3 }];

  assert.deepEqual(planCartReconciliation(cart, desired), {
    remove: [],
    update: [{ item: cart.items?.[0], quantity: 3 }],
    add: [],
  });
});

test("removes stale lines and adds missing lines without rebuilding the cart", () => {
  const stale = item("stale", 7, 1);
  const cart: StoreApiCart = { items: [stale], totals };
  const desired: ResolvedCartLine[] = [{ productId: 9, variationId: null, quantity: 2 }];

  assert.deepEqual(planCartReconciliation(cart, desired), {
    remove: [stale],
    update: [],
    add: desired,
  });
});

test("matches a variation by its purchasable Store API id", () => {
  const variation = item("variation", 105, 2, 10);
  const cart: StoreApiCart = { items: [variation], totals };
  const desired: ResolvedCartLine[] = [{ productId: 10, variationId: 105, quantity: 2 }];

  assert.deepEqual(planCartReconciliation(cart, desired), {
    remove: [],
    update: [],
    add: [],
  });
});
