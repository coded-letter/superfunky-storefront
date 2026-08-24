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
  assert.match(accountSource, /'url'\s*=>\s*esc_url_raw/);
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

test("guest download access validates order key and billing email", () => {
  assert.match(accountSource, /hash_equals\(\s*\(string\) \$order->get_order_key\(\), \$order_key\s*\)/);
  assert.match(
    accountSource,
    /hash_equals\(\s*strtolower\(\s*\(string\) \$order->get_billing_email\(\)\s*\),\s*strtolower\(\s*\$email\s*\)\s*\)/,
  );
  assert.match(accountSource, /funkycommerce_download_forbidden/);
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
