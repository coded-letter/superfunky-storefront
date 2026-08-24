import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkoutSourceUrl = new URL("../src/pages/CheckoutMockupPage.tsx", import.meta.url);

test("Stripe's online payment option is hidden when its gateway isn't configured", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");
  const paymentSection = source.slice(
    source.indexOf("const paymentSection ="),
    source.indexOf("const shippingSection =") !== -1
      ? source.indexOf("const shippingSection =")
      : source.length,
  );

  // Every other gateway (crypto, BACS, cheque) is only rendered once its own
  // availability flag confirms the backend actually exposes it — Stripe's "Pay
  // online" option must follow the same rule instead of always rendering.
  assert.match(paymentSection, /\{!isBackendConfigured \|\| isStripeGatewayEnabled \? \(/);
  assert.match(paymentSection, /label="Pay online"[\s\S]*?<StripeCardElement/);

  // When Stripe becomes unavailable while it's the selected method, checkout must
  // fall back to another real gateway instead of getting stuck on a hidden option.
  assert.match(
    source,
    /if \(isCryptoOnlyCurrency \|\| !isBackendConfigured \|\| isStripeGatewayEnabled\) return;\s*\n\s*if \(paymentMethod !== "stripe" && paymentMethod !== "blik"\) return;/,
  );
  assert.match(source, /if \(isBacsAvailable\) setPaymentMethod\("bacs"\);/);
  assert.match(source, /else if \(isCheckAvailable\) setPaymentMethod\("cheque"\);/);
  assert.match(source, /else if \(isCodAvailable\) setPaymentMethod\("cod"\);/);
  assert.match(source, /else if \(isCryptoAvailable\) setPaymentMethod\("crypto"\);/);
});
