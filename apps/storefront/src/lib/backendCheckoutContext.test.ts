import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkoutContextPath = new URL(
  "../../../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/inc/checkout-context.php",
  import.meta.url,
);
const checkoutContext = readFileSync(checkoutContextPath, "utf8");

test("checkout registration recognizes encoded Store API rest_route URLs", () => {
  assert.match(
    checkoutContext,
    /rawurldecode\(\s*wp_unslash\(\s*\$_SERVER\['REQUEST_URI'\]/,
  );
  assert.match(checkoutContext, /woocommerce_checkout_registration_enabled/);
});

test("Woo Stripe order reconciliation is CORS-enabled for the headless storefront", () => {
  assert.match(checkoutContext, /wc_stripe_update_order_status/);
  assert.match(checkoutContext, /Access-Control-Allow-Origin: \*/);
  assert.match(checkoutContext, /hash_equals\(\s*\(string\) \$order->get_order_key\(\), \$order_key\s*\)/);
  assert.match(checkoutContext, /wp_set_current_user\(\s*\(int\) \$order->get_customer_id\(\)\s*\)/);
});

test("checkout-created customers are linked to their order", () => {
  assert.match(checkoutContext, /_funkycommerce_checkout_account_username/);
  assert.match(checkoutContext, /woocommerce_store_api_checkout_order_processed/);
  assert.match(checkoutContext, /\$order->set_customer_id\(\s*\$user->ID\s*\)/);
  assert.match(
    checkoutContext,
    /hash_equals\(\s*strtolower\(\s*\(string\) \$user->user_email\s*\),\s*strtolower\(\s*\$email\s*\)\s*\)/,
  );
  assert.match(checkoutContext, /claim-customer/);
  assert.match(checkoutContext, /funkycommerce_can_claim_checkout_order/);
  assert.match(checkoutContext, /funkycommerce_order_already_claimed/);
});

test("BLIK reconciliation verifies Stripe and uses Woo Stripe's webhook handler", () => {
  assert.match(checkoutContext, /reconcile-blik/);
  assert.match(checkoutContext, /WC_Stripe_API::retrieve/);
  assert.match(checkoutContext, /validate_intent_for_order/);
  assert.match(checkoutContext, /WC_Stripe_Webhook_Handler/);
  assert.match(checkoutContext, /process_payment_intent/);
  assert.match(checkoutContext, /wc_stripe_allowed_payment_processing_statuses/);
  assert.match(checkoutContext, /stripe_blik[\s\S]*on-hold/);
  assert.match(checkoutContext, /hash_equals\(\s*\(string\) \$order->get_order_key\(\),\s*\(string\) \$order_key\s*\)/);
});
