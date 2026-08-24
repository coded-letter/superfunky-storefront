import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accountPath = new URL(
  "../../../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/inc/account.php",
  import.meta.url,
);
const accountSource = readFileSync(accountPath, "utf8");
const functionsSource = readFileSync(new URL(
  "../../../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/functions.php",
  import.meta.url,
), "utf8");

test("account orders expose only WooCommerce-granted signed downloads", () => {
  assert.match(accountSource, /function funkycommerce_order_downloads/);
  assert.match(accountSource, /! \$order->is_download_permitted\(\)/);
  assert.match(accountSource, /\$order->get_downloadable_items\(\)/);
  assert.match(accountSource, /'url'\s*=>\s*\$url/);
  assert.doesNotMatch(accountSource, /get_file_download_path/);
});

test("account profile payload defers expensive WooCommerce order loading until orders are queried", () => {
  const payloadMatch = accountSource.match(/function funkycommerce_account_payload[\s\S]*?\n\}/);
  assert.ok(payloadMatch, "account payload function should exist");
  assert.doesNotMatch(payloadMatch[0], /funkycommerce_account_orders/);
  assert.match(
    accountSource,
    /'orders'\s*=>\s*array\([\s\S]*?'resolve'\s*=>\s*fn\( \$account \) => funkycommerce_account_orders/,
  );
});

test("seven-day download access validates order key and billing email for guest and checkout-created customers", () => {
  assert.match(accountSource, /hash_equals\(\s*\(string\) \$order->get_order_key\(\), \$order_key\s*\)/);
  assert.match(
    accountSource,
    /hash_equals\(\s*strtolower\(\s*\(string\) \$order->get_billing_email\(\)\s*\),\s*strtolower\(\s*\$email\s*\)\s*\)/,
  );
  assert.match(accountSource, /funkycommerce_download_forbidden/);
  assert.match(accountSource, /sf_guest_expires/);
  assert.match(accountSource, /sf_guest_token/);
  assert.match(accountSource, /function funkycommerce_guest_download_signature/);
  assert.match(accountSource, /pre_option_woocommerce_downloads_require_login/);
  const accessWindow = accountSource.match(/function funkycommerce_guest_download_access_is_current[\s\S]*?\n\}/);
  assert.ok(accessWindow);
  assert.doesNotMatch(accessWindow[0], /get_customer_id/);
  assert.match(accountSource, /function funkycommerce_guest_download_access_is_current/);
  assert.match(
    accountSource,
    /function funkycommerce_guest_download_access_is_current[\s\S]*?\n\}\n\n\/\*\*[\s\S]*?function funkycommerce_guest_download_signature/,
  );
  assert.match(accountSource, /7 \* DAY_IN_SECONDS/);
  assert.match(accountSource, /get_date_completed\(\) \?: \$order->get_date_paid\(\) \?: \$order->get_date_created\(\)/);
  assert.match(accountSource, /hash_equals\( \$expected, \$token \)/);
  assert.match(accountSource, /funkycommerce_order_downloads\( \$order, \$guest_access \)/);
  assert.match(accountSource, /function funkycommerce_issue_guest_download_access_token/);
  assert.match(accountSource, /_funkycommerce_guest_download_tokens/);
  assert.match(accountSource, /array_slice\( \$tokens, -5 \)/);
  assert.match(accountSource, /foreach \( \(array\) \$order->get_meta\( '_funkycommerce_guest_download_tokens'/);
  assert.match(accountSource, /function funkycommerce_guest_download_access_token_is_valid/);
  assert.match(accountSource, /'access_token'\s*=>\s*\$access_token/);
  assert.doesNotMatch(accountSource, /'email'\s*=>\s*\$order->get_billing_email\(\)/);
  assert.match(accountSource, /Cache-Control', 'no-store, private'/);
});

test("downloadable-order emails link account and guest customers to headless access", () => {
  assert.match(accountSource, /funkycommerce_frontend_url\(\s*'account#downloads'\s*\)/);
  assert.match(accountSource, /funkycommerce_frontend_url\(\s*'order-success\/digital'\s*\)/);
  assert.match(accountSource, /woocommerce_email_after_order_table/);
});

test("the account shortcode accepts the downloads hash tab", () => {
  assert.match(functionsSource, /dashboard', 'orders', 'downloads', 'addresses', 'community/);
  assert.match(functionsSource, /dashboard,orders,downloads,addresses,community/);
});
