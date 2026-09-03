import assert from "node:assert/strict";
import test from "node:test";
import {
  isAbandonedCartFeatureAvailable,
  normalizeAbandonedCartPublicConfig,
  stripAbandonedCartRecoveryParams,
} from "./abandonedCartConfig.ts";

test("normalizes abandoned-cart public config against safe language fallbacks", () => {
  const normalized = normalizeAbandonedCartPublicConfig(
    {
      configVersion: "2",
      language: {
        language: "zz",
        locale: "??",
        defaultLanguage: "de",
        defaultLocale: "de_DE",
        fallbackUsed: true,
      },
      checkout: {
        mode: "legitimate_interest",
        consentLabel: "",
        debounceMs: -5,
        idleMs: -10,
      },
      store: {
        cartUrl: "javascript:alert(1)",
        recoveryWindow: 0,
      },
    },
    {
      languageCode: "pl",
      locale: "PL",
      configuredLanguageCodes: ["pl", "en"],
    },
  );

  assert.equal(normalized.configVersion, "2");
  assert.equal(normalized.language.language, "pl");
  assert.equal(normalized.language.defaultLanguage, "pl");
  assert.equal(normalized.checkout.mode, "legitimate_interest");
  assert.match(normalized.checkout.consentLabel, /legitimate interests/);
  assert.equal(normalized.checkout.debounceMs, 2000);
  assert.equal(normalized.checkout.idleMs, 30000);
  assert.equal(normalized.store.cartUrl, "/cart");
  assert.equal(normalized.store.recoveryWindow, 30);
});

test("requires the abandoned-cart plugin endpoint and enabled checkout capability", () => {
  const normalized = normalizeAbandonedCartPublicConfig(
    {
      endpoints: { headless: "/wp-json/funkycommerce/v1/abandoned-carts" },
      checkout: { enabled: true },
    },
    { languageCode: "en", locale: "en_US" },
  );

  assert.equal(isAbandonedCartFeatureAvailable(normalized), true);
  assert.equal(
    isAbandonedCartFeatureAvailable({
      ...normalized,
      endpoints: { ...normalized.endpoints, headless: "" },
    }),
    false,
  );
  assert.equal(
    isAbandonedCartFeatureAvailable({
      ...normalized,
      checkout: { ...normalized.checkout, enabled: false },
    }),
    false,
  );
});

test("strips abandoned-cart recovery params without touching other params", () => {
  const cleaned = stripAbandonedCartRecoveryParams(
    new URLSearchParams("foo=1&funkycommerce_recovery=abc&mode=headless&language=pl&locale=PL"),
  );

  assert.equal(cleaned.toString(), "foo=1");
});
