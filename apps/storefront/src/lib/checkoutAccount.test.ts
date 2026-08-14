import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckoutOrderClaimRequest } from "./checkoutAccountRequest.ts";

test("builds an authenticated checkout-order claim request", () => {
  const request = buildCheckoutOrderClaimRequest(
    "https://shop.example",
    { order_id: 42, order_key: "wc_order_secret" },
    " buyer@example.com ",
  );
  const url = new URL(request.url);

  assert.equal(url.searchParams.get("rest_route"), "/funkycommerce/v1/orders/42/claim-customer");
  assert.deepEqual(request.body, {
    key: "wc_order_secret",
    email: "buyer@example.com",
  });
});
