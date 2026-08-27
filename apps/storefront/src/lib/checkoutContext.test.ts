import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckoutExtensions,
  buildStoreCheckoutPayload,
  CHECKOUT_CONTEXT_NAMESPACE,
  withDigitalCheckoutAddress,
} from "./checkoutContext.ts";
import { buildStripePaymentData, toStripeBillingDetails } from "./stripePaymentData.ts";
import { validateCheckoutForm } from "./validation.ts";

test("builds the Store API checkout language and attribution bridge", () => {
  assert.deepEqual(
    buildCheckoutExtensions({
      language: "PL",
      backendLanguage: "pl",
      currency: "pln",
      captureKey: "fc1-test-capture-key-123456",
      entryUrl: "https://funkycommerce.netlify.app/pl/checkout/",
      referrer: "https://example.com/campaign",
      userAgent: "Storefront test browser",
      sessionStartTime: "2026-08-06T01:00:00.000Z",
    }),
    {
      [CHECKOUT_CONTEXT_NAMESPACE]: {
        language: "pl",
        backend_language: "pl",
        currency: "PLN",
        account_username: "",
        marketing_consent: false,
        marketing_consent_label: "",
        capture_key: "fc1-test-capture-key-123456",
        session_entry: "https://funkycommerce.netlify.app/pl/checkout/",
        referrer: "https://example.com/campaign",
        user_agent: "Storefront test browser",
        session_start_time: "2026-08-06T01:00:00.000Z",
        digital_order: false,
      },
    },
  );
});

test("bounds browser-provided attribution values", () => {
  const context = buildCheckoutExtensions({
    language: "en",
    backendLanguage: "en",
    captureKey: "fc1-test-capture-key-123456",
    entryUrl: "x".repeat(700),
  })[CHECKOUT_CONTEXT_NAMESPACE];

  assert.equal(context.session_entry.length, 500);
});

test("checkout payload preserves language, order notes, and a different shipping address", () => {
  const billing = {
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical Engines Ltd",
    addressLine1: "1 Billing Road",
    city: "London",
    state: "London",
    postcode: "SW1A 1AA",
    countryCode: "GB",
    email: "ada@example.com",
    phone: "+44 20 1234 5678",
  };
  const payload = buildStoreCheckoutPayload(billing, "cod", {
    language: "pl",
    backendLanguage: "PL",
    selectedCurrency: "PLN",
    createAccount: true,
    accountUsername: "ada.lovelace",
    customerPassword: "correct-horse-battery-staple",
    subscribeToNewsletter: true,
    marketingConsentLabel: "Keep me posted about new drops, offers, and restocks by email.",
    customerNote: "  Leave with reception.  ",
    shippingAddress: {
      ...billing,
      firstName: "Grace",
      lastName: "Hopper",
      addressLine1: "2 Shipping Lane",
    },
  });

  assert.equal(payload.customer_note, "Leave with reception.");
  assert.equal(payload.billing_address.first_name, "Ada");
  assert.equal(payload.billing_address.company, "Analytical Engines Ltd");
  assert.equal(payload.shipping_address?.first_name, "Grace");
  assert.equal(payload.shipping_address?.address_1, "2 Shipping Lane");
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].language, "pl");
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].backend_language, "PL");
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].currency, "PLN");
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].account_username, "ada.lovelace");
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].marketing_consent, true);
  assert.equal(
    payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].marketing_consent_label,
    "Keep me posted about new drops, offers, and restocks by email.",
  );
  assert.equal(payload.create_account, true);
  assert.equal(payload.customer_password, "correct-horse-battery-staple");
});

test("digital checkout supplies a country-valid Store API and Stripe fallback address", () => {
  const billing = {
    firstName: "Ada",
    lastName: "Lovelace",
    addressLine1: "",
    city: "",
    postcode: "",
    countryCode: "PL",
    email: "ada@example.com",
    phone: "+48 123 456 789",
  };
  const paymentBilling = withDigitalCheckoutAddress(billing);
  const payload = buildStoreCheckoutPayload(
    billing,
    "funkycommerce_crypto",
    { digitalOrder: true },
  );
  const stripePaymentData = new Map(
    buildStripePaymentData(paymentBilling, "pm_digital").map(({ key, value }) => [key, value]),
  );
  const stripeBilling = toStripeBillingDetails(paymentBilling);

  assert.equal(payload.billing_address.address_1, "Dostawa cyfrowa 1");
  assert.equal(payload.billing_address.city, "Warszawa");
  assert.equal(payload.billing_address.state, "MZ");
  assert.equal(payload.billing_address.postcode, "00-001");
  assert.equal(payload.billing_address.country, "PL");
  assert.deepEqual(payload.shipping_address, payload.billing_address);
  assert.equal(payload.extensions?.[CHECKOUT_CONTEXT_NAMESPACE].digital_order, true);
  assert.equal(stripePaymentData.get("billing_address_1"), "Dostawa cyfrowa 1");
  assert.equal(stripePaymentData.get("billing_city"), "Warszawa");
  assert.equal(stripePaymentData.get("billing_state"), "MZ");
  assert.equal(stripePaymentData.get("billing_postcode"), "00-001");
  assert.equal(stripeBilling.address.line1, "Dostawa cyfrowa 1");
  assert.equal(stripeBilling.address.city, "Warszawa");
  assert.equal(stripeBilling.address.state, "MZ");
  assert.equal(stripeBilling.address.postal_code, "00-001");
});

test("digital checkout uses valid state and postcode formats for supported countries", () => {
  const countries = [
    { countryCode: "DE", state: "DE-BE", postcode: "10115" },
    { countryCode: "FR", state: "75", postcode: "75001" },
    { countryCode: "GB", state: "London", postcode: "SW1A 1AA" },
    { countryCode: "NL", state: "NH", postcode: "1011 AA" },
    { countryCode: "US", state: "CA", postcode: "94105" },
  ];

  for (const country of countries) {
    const address = withDigitalCheckoutAddress({
      firstName: "Ada",
      lastName: "Lovelace",
      addressLine1: "",
      city: "",
      postcode: "",
      countryCode: country.countryCode,
      email: "ada@example.com",
      phone: "+48 123 456 789",
    });
    assert.equal(address.state, country.state);
    assert.equal(address.postcode, country.postcode);
  }
});

test("physical checkout does not invent missing address fields", () => {
  const payload = buildStoreCheckoutPayload(
    {
      firstName: "Ada",
      lastName: "Lovelace",
      addressLine1: "",
      city: "",
      postcode: "",
      countryCode: "PL",
      email: "ada@example.com",
      phone: "+48 123 456 789",
    },
    "cod",
  );

  assert.equal(payload.billing_address.address_1, "");
  assert.equal(payload.billing_address.city, "");
  assert.equal(payload.billing_address.postcode, "");
});

test("checkout validates a required state consistently with other address fields", () => {
  const result = validateCheckoutForm({
    firstName: "Ada",
    lastName: "Lovelace",
    country: "GB",
    address1: "1 Billing Road",
    city: "London",
    state: "",
    postcode: "SW1A 1AA",
    phone: "+44 20 1234 5678",
    email: "ada@example.com",
    requiresShipping: true,
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.state, "State / county is required");
});
