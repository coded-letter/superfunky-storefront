import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrderConfirmation,
  loadOrderConfirmation,
  ORDER_CONFIRMATION_TTL_MS,
  orderConfirmationFromNavigationState,
  saveOrderConfirmation,
} from "./orderConfirmation.ts";
import { localizedOrderStatus } from "./orderPresentation.ts";

const checkoutOrder = {
  order_id: 1042,
  order_key: "wc_order_test",
  order_number: "1042",
  status: "processing",
  payment_method: "cod",
  billing_address: {
    first_name: "Jordan",
    last_name: "Reyes",
    address_1: "1 Test Street",
    city: "Athens",
    postcode: "105 57",
    country: "GR",
    email: "jordan@example.com",
  },
  payment_result: {
    payment_status: "success" as const,
    payment_details: [],
    redirect_url: "https://store.example/order-received/1042",
  },
};

test("captures the completed cart and checkout totals before the cart is cleared", () => {
  const confirmation = createOrderConfirmation({
    mode: "physical",
    order: checkoutOrder,
    billingEmail: "jordan@example.com",
    currency: "eur",
    items: [{
      id: "product-1",
      name: "Weekender Bag",
      variantLabel: "Sandstone",
      priceLabel: "€20.00",
      priceAmount: 20,
      quantity: 2,
    }],
    formatAmount: (amount) => `€${amount.toFixed(2)}`,
    subtotal: 40,
    discount: 4,
    shipping: 6,
    tax: 8,
    total: 50,
    coupons: ["WELCOME10"],
    shippingMethod: "Standard shipping",
  });

  assert.deepEqual(confirmation.items, [{
    id: "product-1",
    name: "Weekender Bag",
    variant: "Sandstone",
    quantity: 2,
    total: "€40.00",
  }]);
  assert.deepEqual(confirmation.totals, {
    subtotal: "€40.00",
    discount: "-€4.00",
    shipping: "€6.00",
    tax: "€8.00",
    total: "€50.00",
  });
  assert.equal(orderConfirmationFromNavigationState({ confirmation })?.order.order_id, 1042);
  assert.equal(confirmation.currency, "EUR");
});

test("labels digital delivery without inventing a shipping charge", () => {
  const confirmation = createOrderConfirmation({
    mode: "digital",
    order: checkoutOrder,
    billingEmail: "jordan@example.com",
    currency: "EUR",
    items: [],
    formatAmount: (amount) => `€${amount.toFixed(2)}`,
    subtotal: 10,
    discount: 0,
    shipping: 0,
    tax: 2,
    total: 12,
    coupons: [],
  });

  assert.equal(confirmation.totals.shipping, "Digital delivery");
  assert.equal(confirmation.totals.discount, undefined);
});

test("allows only a matching guest order during the 24-hour access window", () => {
  const now = Date.parse("2026-08-03T12:00:00.000Z");
  const confirmation = {
    ...createOrderConfirmation({
      mode: "physical",
      order: checkoutOrder,
      billingEmail: "jordan@example.com",
      currency: "EUR",
      items: [],
      formatAmount: (amount) => `€${amount.toFixed(2)}`,
      subtotal: 10,
      discount: 0,
      shipping: 0,
      tax: 2,
      total: 12,
      coupons: [],
    }),
    capturedAt: new Date(now - ORDER_CONFIRMATION_TTL_MS + 1).toISOString(),
  };

  assert.equal(orderConfirmationFromNavigationState({ confirmation }, 1042, now)?.order.order_id, 1042);
  assert.equal(orderConfirmationFromNavigationState({ confirmation }, 9999, now), null);
});

test("removes an expired guest confirmation from session storage", () => {
  const values = new Map<string, string>();
  let removals = 0;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => {
          removals += 1;
          values.delete(key);
        },
      },
    },
  });

  try {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const confirmation = {
      ...createOrderConfirmation({
        mode: "physical",
        order: checkoutOrder,
        billingEmail: "jordan@example.com",
        currency: "EUR",
        items: [],
        formatAmount: (amount) => `€${amount.toFixed(2)}`,
        subtotal: 10,
        discount: 0,
        shipping: 0,
        tax: 2,
        total: 12,
        coupons: [],
      }),
      capturedAt: new Date(now - ORDER_CONFIRMATION_TTL_MS).toISOString(),
    };
    saveOrderConfirmation(confirmation);

    assert.equal(loadOrderConfirmation(1042, now), null);
    assert.equal(removals, 1);
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("localizes known order statuses and preserves backend labels for custom statuses", () => {
  const strings: Record<string, string> = {
    "order_status.processing": "W realizacji",
  };
  const t = (key: string) => strings[key] ?? key;

  assert.equal(localizedOrderStatus("processing", "Processing", t), "W realizacji");
  assert.equal(localizedOrderStatus("awaiting-stock", "Awaiting stock", t), "Awaiting stock");
});
