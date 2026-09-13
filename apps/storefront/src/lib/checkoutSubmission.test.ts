import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkoutPageSource = readFileSync(
  new URL("../pages/CheckoutMockupPage.tsx", import.meta.url),
  "utf8",
);
const handlerSource = checkoutPageSource.slice(
  checkoutPageSource.indexOf("async function handlePlaceOrder"),
  checkoutPageSource.indexOf("const displayShippingMethods"),
);

test("checkout blocks link navigation and validates before choosing a submission path", () => {
  const preventNavigationIndex = handlerSource.indexOf("event.preventDefault()");
  const validationIndex = handlerSource.indexOf("validateCheckoutForm({");
  const submissionPathIndex = handlerSource.indexOf("if (!canSubmitRealOrder)");

  assert.ok(preventNavigationIndex >= 0, "checkout must block the CTA link's automatic success navigation");
  assert.ok(validationIndex > preventNavigationIndex, "checkout validation must run after navigation is blocked");
  assert.ok(submissionPathIndex > validationIndex, "checkout must validate before selecting live or mock submission");
});
