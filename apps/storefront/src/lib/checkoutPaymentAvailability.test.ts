import assert from "node:assert/strict";
import test from "node:test";
import { isCheckoutPaymentMethodAvailable } from "./checkoutPaymentAvailability.ts";
import type { StoreApiCart } from "./wcStoreApi.ts";

const totals: StoreApiCart["totals"] = {
  currency_code: "PLN",
  currency_symbol: "zł",
  currency_minor_unit: 2,
  currency_decimal_separator: ".",
  currency_thousand_separator: "",
  currency_prefix: "",
  currency_suffix: "zł",
  total_price: "10000",
};

test("uses cart-scoped gateways for shipping-dependent payment methods", () => {
  const cart: StoreApiCart = {
    payment_methods: ["stripe", "bacs", "cod"],
    totals,
  };

  assert.equal(isCheckoutPaymentMethodAvailable(cart, "cod", false), true);
  assert.equal(isCheckoutPaymentMethodAvailable(cart, "cheque", true), false);
});

test("uses configured gateway availability until the Store API cart is ready", () => {
  assert.equal(isCheckoutPaymentMethodAvailable(null, "cod", true), true);
  assert.equal(isCheckoutPaymentMethodAvailable(null, "cod", false), false);
});
