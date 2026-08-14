import assert from "node:assert/strict";
import test from "node:test";
import {
  blikReconciliationOutcome,
  buildBlikReconciliationRequest,
} from "./blikPayment.ts";

test("builds an order-key-protected BLIK reconciliation request", () => {
  const request = buildBlikReconciliationRequest(
    "https://shop.example",
    { order_id: 42, order_key: "wc_order_secret" },
    " buyer@example.com ",
  );
  const url = new URL(request.url);

  assert.equal(url.searchParams.get("rest_route"), "/funkycommerce/v1/orders/42/reconcile-blik");
  assert.deepEqual(request.body, {
    key: "wc_order_secret",
    email: "buyer@example.com",
  });
});

test("distinguishes approved, processing, pending, and failed BLIK intents", () => {
  assert.equal(
    blikReconciliationOutcome({ payment_status: "success", intent_status: "succeeded" }),
    "success",
  );
  assert.equal(
    blikReconciliationOutcome({ payment_status: "processing", order_status: "on-hold" }),
    "processing",
  );
  assert.equal(
    blikReconciliationOutcome({ payment_status: "pending", intent_status: "requires_action" }),
    "pending",
  );
  assert.equal(
    blikReconciliationOutcome({ payment_status: "failure", intent_status: "requires_payment_method" }),
    "failure",
  );
});
