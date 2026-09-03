import assert from "node:assert/strict";
import test from "node:test";
import { checkoutCartMatchesShippingAddress } from "./checkoutInitialization.ts";
import type { StoreApiAddress, StoreApiCart } from "./wcStoreApi.ts";

const address: StoreApiAddress = {
  first_name: "",
  last_name: "",
  address_1: "",
  city: "",
  postcode: "",
  country: "PL",
};
const cart: StoreApiCart = {
  needs_shipping: true,
  has_calculated_shipping: true,
  shipping_rates: [{
    package_id: 0,
    name: "Shipment",
    destination: {
      address_1: "",
      address_2: "",
      city: "",
      state: "",
      postcode: "",
      country: "PL",
    },
    items: [],
    shipping_rates: [{
      rate_id: "free_shipping:2",
      name: "Free shipping",
      price: "0",
      selected: true,
    }],
  }],
  totals: {
    currency_code: "PLN",
    currency_symbol: "zł",
    currency_minor_unit: 2,
    currency_decimal_separator: ".",
    currency_thousand_separator: "",
    currency_prefix: "",
    currency_suffix: "zł",
    total_price: "10000",
    total_tax: "2300",
  },
};

test("reuses shipping and tax data already calculated for the default country", () => {
  assert.equal(checkoutCartMatchesShippingAddress(cart, address), true);
});

test("refreshes shipping when the customer enters a different destination", () => {
  assert.equal(
    checkoutCartMatchesShippingAddress(cart, {
      ...address,
      country: "DE",
    }),
    false,
  );
  assert.equal(
    checkoutCartMatchesShippingAddress(cart, {
      ...address,
      postcode: "00-001",
    }),
    false,
  );
});

test("does not treat uncalculated or digital carts as initialized shipping data", () => {
  assert.equal(
    checkoutCartMatchesShippingAddress(
      { ...cart, has_calculated_shipping: false },
      address,
    ),
    false,
  );
  assert.equal(
    checkoutCartMatchesShippingAddress(
      { ...cart, needs_shipping: false },
      address,
    ),
    false,
  );
});
