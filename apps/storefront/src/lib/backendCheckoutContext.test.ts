import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkoutContextPath = new URL(
  "../../../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/inc/checkout-context.php",
  import.meta.url,
);
const checkoutContext = readFileSync(checkoutContextPath, "utf8");
const checkoutPage = readFileSync(new URL("../pages/CheckoutMockupPage.tsx", import.meta.url), "utf8");

test("checkout registration recognizes encoded Store API rest_route URLs", () => {
  assert.match(
    checkoutContext,
    /rawurldecode\(\s*wp_unslash\(\s*\$_SERVER\['REQUEST_URI'\]/,
  );
  assert.match(checkoutContext, /woocommerce_checkout_registration_enabled/);
  assert.match(checkoutContext, /woocommerce_checkout_registration_required/);
  assert.match(checkoutContext, /option_woocommerce_enable_guest_checkout/);
  assert.match(checkoutContext, /array\( 'guest', 'optional', 'required' \)/);
  assert.match(checkoutContext, /\$request->set_param\( 'create_account', \$create_account \)/);
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
  assert.match(checkoutContext, /wp_new_user_notification\( \$customer_id, null, 'user' \)/);
  assert.match(checkoutContext, /woocommerce_email_enabled_customer_new_account/);
  assert.match(checkoutContext, /woocommerce_created_customer/);
  assert.match(checkoutContext, /_funkycommerce_checkout_account_notification_sent/);
});

test("the storefront follows the backend account mode and retries automatic login after checkout errors", () => {
  assert.match(checkoutPage, /checkoutPresentation\?\.accountMode/);
  assert.match(checkoutPage, /accountMode === "guest"/);
  assert.match(checkoutPage, /accountMode === "optional"/);
  assert.match(checkoutPage, /accountMode === "required"/);
  assert.match(
    checkoutPage,
    /if \(shouldCreateAccount\) \{[\s\S]*?const auth = await login\(normalizedUsername, accountPassword\);[\s\S]*?if \(result\.order\)/,
  );
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

test("selected PLN enables backend-controlled Stripe BLIK without changing the store base currency", () => {
  assert.match(checkoutContext, /function funkycommerce_blik_presentation_enabled/);
  assert.match(checkoutContext, /'blik_enabled'/);
  assert.match(checkoutContext, /function funkycommerce_enable_selected_blik_gateway/);
  assert.match(checkoutContext, /rest_request_before_callbacks/);
  assert.match(checkoutContext, /FUNKYCOMMERCE_CHECKOUT_CONTEXT_NAMESPACE/);
  assert.match(checkoutContext, /'PLN' !== funkycommerce_store_api_payment_currency\(\)/);
  assert.match(checkoutContext, /empty\( \$gateways\['stripe'\] \)/);
  assert.match(checkoutContext, /\$registered\['stripe_blik'\]/);
  assert.match(checkoutContext, /function funkycommerce_convert_blik_order_to_pln/);
  assert.match(checkoutContext, /get_option\( 'woocommerce_currency', 'EUR' \)/);
  assert.match(checkoutContext, /\$rates\['PLN'\]/);
  assert.match(checkoutContext, /\$order->calculate_totals\( false \)/);
  assert.match(checkoutContext, /\$order->set_currency\( 'PLN' \)/);
  assert.match(checkoutContext, /funkycommerce-blik-rate-unavailable/);
});
