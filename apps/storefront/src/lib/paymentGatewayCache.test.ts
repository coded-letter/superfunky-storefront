import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isPaymentGatewayCacheTimestampUsable,
  parsePaymentGatewayCacheSeed,
  restorePaymentGatewayCache,
} from "./paymentGatewayCache.ts";

const paymentsSource = readFileSync(new URL("./payments.ts", import.meta.url), "utf8");
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");

test("checkout restores a bounded public payment-gateway cache synchronously", () => {
  const cachedAt = Date.now();
  const restored = restorePaymentGatewayCache(JSON.stringify({
    cachedAt,
    gateways: [
      { id: "stripe", title: "Card", description: "Pay by card" },
      { id: "stripe_blik", title: "BLIK", description: null },
      { id: "funkycommerce_crypto", title: "Crypto", description: "Pay by wallet" },
    ],
    blikEnabled: true,
    cryptoAssets: [{
      code: "btc",
      label: "Bitcoin",
      network: "Bitcoin",
      wallet: "bc1-public-wallet",
      fiatRate: 0.00001,
      qrUrl: null,
    }],
  }));
  assert.ok(restored);
  assert.deepEqual(restored.seed.gateways.map(({ id }) => id), [
    "stripe",
    "stripe_blik",
    "funkycommerce_crypto",
  ]);
  assert.equal(restored.seed.cryptoAssets[0]?.code, "btc");
  assert.equal(restored.seed.blikEnabled, true);
  assert.equal(parsePaymentGatewayCacheSeed({
    gateways: [{ id: "stripe", title: "Card" }],
    cryptoAssets: [],
  })?.blikEnabled, false);

  assert.equal(isPaymentGatewayCacheTimestampUsable(cachedAt - 86_400_001, cachedAt), false);
  assert.equal(isPaymentGatewayCacheTimestampUsable(cachedAt - 86_400_000, cachedAt), true);
  assert.equal(parsePaymentGatewayCacheSeed({
    gateways: [{ id: "stripe", title: "Card", customerEmail: "private@example.com" }],
    blikEnabled: true,
    cryptoAssets: [],
  }), null);
  assert.equal(parsePaymentGatewayCacheSeed({
    gateways: [{ id: "stripe", title: "Card" }],
    blikEnabled: true,
    cryptoAssets: [{ code: "btc", label: "Bitcoin" }],
  }), null);
  assert.ok(parsePaymentGatewayCacheSeed({
    gateways: [{ id: "stripe", title: "Card" }],
    blikEnabled: true,
    cryptoAssets: [{
      code: "btc",
      label: "Bitcoin",
      network: "Bitcoin",
      wallet: "bc1-public-wallet",
      fiatRate: null,
    }],
  }));
});

test("checkout cache is prerendered, revalidated, and persists only public presentation data", () => {
  assert.match(prerenderSource, /STATIC_PAYMENT_GATEWAYS_QUERY/);
  assert.match(prerenderSource, /id="storefront-payment-gateway-cache"/);
  assert.match(paymentsSource, /Date\.now\(\) - cachedGatewayAt < PAYMENT_GATEWAY_FRESH_MS/);
  assert.match(paymentsSource, /\.finally\(\(\) => \{\s*inFlight = null;/);
  assert.match(paymentsSource, /useState<PaymentGatewayAvailability>\(\(\) =>\s*getCachedPaymentGatewayAvailability/);
  assert.match(paymentsSource, /typeof asset\.fiatRate === "number" && asset\.fiatRate > 0/);
  assert.match(paymentsSource, /currencyCode === "PLN"[\s\S]*snapshot\?\.blikEnabled[\s\S]*ids\.has\("stripe"\)/);
  assert.doesNotMatch(paymentsSource, /isBlikAvailable:.*ids\.has\("stripe_blik"\)/);
  assert.match(paymentsSource, /LEGACY_PAYMENT_GATEWAYS_QUERY/);

  const persistenceBlock = paymentsSource.slice(
    paymentsSource.indexOf("function persistGatewaySnapshot"),
    paymentsSource.indexOf("const persistedGatewayCache"),
  );
  assert.match(persistenceBlock, /gateways: Array\.from\(snapshot\.gateways\.values\(\)\)/);
  assert.match(persistenceBlock, /blikEnabled: snapshot\.blikEnabled/);
  assert.match(persistenceBlock, /cryptoAssets: snapshot\.cryptoAssets/);
  assert.doesNotMatch(persistenceBlock, /customer|address|cart|order|nonce|paymentToken/i);
});
