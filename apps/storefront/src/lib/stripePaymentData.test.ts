import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripePaymentData,
  buildStripeOrderStatusRequest,
  parseStripeConfirmationRedirect,
  stripeOrderStatusError,
  toStripeBillingDetails,
} from "./stripePaymentData.ts";

const billing = {
  firstName: "Anna",
  lastName: "Kowalska",
  addressLine1: "Prosta 1",
  city: "Warsaw",
  postcode: "00-001",
  countryCode: "PL",
  email: "anna@example.com",
  phone: "+48123456789",
};

test("builds the Woo Stripe UPE card payment-data contract", () => {
  const values = new Map(
    buildStripePaymentData(billing, "pm_test_card", {
      selectedPaymentType: "card",
    }).map(({ key, value }) => [key, value]),
  );

  assert.equal(values.get("wc-stripe-payment-method"), "pm_test_card");
  assert.equal(values.get("payment_method"), "stripe");
  assert.equal(values.get("wc_stripe_selected_upe_payment_type"), "card");
  assert.equal(values.get("billing_email"), billing.email);
  assert.equal(values.get("billing_phone"), billing.phone);
  assert.equal(values.has("wc-stripe-blik-code"), false);
});

test("adds the exact Woo Stripe BLIK code field", () => {
  const values = new Map(
    buildStripePaymentData(billing, "pm_test_blik", {
      gatewayId: "stripe_blik",
      selectedPaymentType: "blik",
      selectedCurrency: "pln",
      blikCode: "123456",
    }).map(({ key, value }) => [key, value]),
  );

  assert.equal(values.get("wc-stripe-payment-method"), "pm_test_blik");
  assert.equal(values.get("payment_method"), "stripe_blik");
  assert.equal(values.get("wc-stripe-blik-code"), "123456");
  assert.equal(values.get("funkycommerce_selected_currency"), "PLN");
});

test("maps billing data for Stripe.js without empty optional strings", () => {
  assert.deepEqual(toStripeBillingDetails(billing), {
    name: "Anna Kowalska",
    email: "anna@example.com",
    phone: "+48123456789",
    address: {
      line1: "Prosta 1",
      city: "Warsaw",
      postal_code: "00-001",
      country: "PL",
    },
  });
});

test("does not send synthetic-looking empty address fields to Stripe.js", () => {
  assert.deepEqual(toStripeBillingDetails({
    ...billing,
    addressLine1: "",
    city: "",
    postcode: "",
  }), {
    name: "Anna Kowalska",
    email: "anna@example.com",
    phone: "+48123456789",
    address: { country: "PL" },
  });
});

test("parses Woo Stripe intent-confirmation redirects", () => {
  assert.deepEqual(
    parseStripeConfirmationRedirect(
      "https://shop.example/order-received/42/#wc-stripe-confirm-pi:42:pi_secret_test:nonce123",
    ),
    {
      intentType: "pi",
      orderId: "42",
      clientSecret: "pi_secret_test",
      nonce: "nonce123",
      returnUrl: "https://shop.example/order-received/42/",
    },
  );
  assert.equal(parseStripeConfirmationRedirect("https://shop.example/thanks"), null);
});

test("builds Woo Stripe's signed order-status reconciliation request", () => {
  const confirmation = parseStripeConfirmationRedirect(
    "#wc-stripe-confirm-pi:42:pi_test_secret_123:nonce123",
  );
  assert.ok(confirmation);

  const request = buildStripeOrderStatusRequest(
    "https://shop.example",
    confirmation,
    "pi_test",
    "wc_order_secret",
  );
  const url = new URL(request.url);

  assert.equal(url.origin, "https://shop.example");
  assert.equal(url.searchParams.get("wc-ajax"), "wc_stripe_update_order_status");
  assert.equal(request.body.get("order_id"), "42");
  assert.equal(request.body.get("order_key"), "wc_order_secret");
  assert.equal(request.body.get("intent_id"), "pi_test");
  assert.equal(request.body.get("_ajax_nonce"), "nonce123");
});

test("reads Woo Stripe reconciliation failures without losing their message", () => {
  assert.equal(stripeOrderStatusError({ success: true }), null);
  assert.equal(
    stripeOrderStatusError({
      success: false,
      data: { error: { message: "The BLIK payment was declined." } },
    }),
    "The BLIK payment was declined.",
  );
});
