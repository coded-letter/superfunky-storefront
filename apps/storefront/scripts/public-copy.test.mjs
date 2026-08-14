import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cmsPage = readFileSync(new URL("../src/components/CmsPageContent.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("../../../packages/ui/src/layout/SearchAutocomplete.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../src/pages/AccountMockupPage.tsx", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../src/pages/CheckoutMockupPage.tsx", import.meta.url), "utf8");

test("browser-exposed custom attributes and core customer copy use neutral terms", () => {
  assert.match(cmsPage, /data-rendered-cms-shortcode/);
  assert.doesNotMatch(cmsPage, /data-rendered-wordpress-shortcode/);
  assert.doesNotMatch(search, /Searching WordPress/);
  assert.doesNotMatch(account, /(?:Sign in|Create an account|Not connected yet)[^\n"]*(?:WordPress|WooCommerce|WPGraphQL)/);
  assert.doesNotMatch(checkout, /(?:description=|Configure the Stripe|The live)[^\n]*(?:WordPress|WooCommerce|WPGraphQL)/);
});
