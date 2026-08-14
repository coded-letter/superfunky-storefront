import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FREE_SHIPPING_METHOD,
  findFreeShippingMethod,
  mapShippingOptionsToDisplayMethods,
} from "./shippingRates.ts";
import type { StoreApiShippingOption } from "./wcStoreApi.ts";

const packageBase = {
  package_id: 0,
  name: "Shipment 1",
  destination: {
    address_1: "",
    address_2: "",
    city: "Warsaw",
    state: "",
    postcode: "00-001",
    country: "PL",
  },
  items: [],
};

test("maps canonical WooCommerce shipping_rates dynamically", () => {
  const options: StoreApiShippingOption[] = [{
    ...packageBase,
    shipping_rates: [
      {
        rate_id: "flat_rate:10",
        name: "Courier",
        description: "Next business day",
        price: "1299",
        selected: true,
      },
      {
        rate_id: "free_shipping:12",
        name: "Free shipping",
        price: "0",
      },
    ],
  }];

  assert.deepEqual(mapShippingOptionsToDisplayMethods(options, [], 2), [
    {
      id: "flat_rate:10",
      label: "Courier",
      eta: "Next business day",
      price: 12.99,
      packageId: 0,
      rateId: "flat_rate:10",
      selected: true,
      disabled: false,
    },
    {
      id: "free_shipping:12",
      label: "Free shipping",
      eta: "Estimated delivery time",
      price: 0,
      packageId: 0,
      rateId: "free_shipping:12",
      selected: false,
      disabled: false,
    },
  ]);
  assert.equal(findFreeShippingMethod(options)?.rate_id, "free_shipping:12");
});

test("handles packages without rates and supports legacy shipping_methods", () => {
  const emptyPackage: StoreApiShippingOption = { ...packageBase };
  const legacyPackage: StoreApiShippingOption = {
    ...packageBase,
    package_id: 1,
    shipping_methods: [{
      rate: "legacy_rate:4",
      name: "Legacy courier",
      delivery_time: "Two days",
      price: "700",
    }],
  };

  assert.deepEqual(mapShippingOptionsToDisplayMethods([emptyPackage], [], 2), []);
  assert.deepEqual(
    mapShippingOptionsToDisplayMethods([emptyPackage], [DEFAULT_FREE_SHIPPING_METHOD], 2),
    [DEFAULT_FREE_SHIPPING_METHOD],
  );
  assert.equal(
    mapShippingOptionsToDisplayMethods([emptyPackage, legacyPackage], [], 2)[0]?.id,
    "legacy_rate:4",
  );
});
