import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync(new URL("../pages/AuthMockupPage.tsx", import.meta.url), "utf8");
const pathsSource = readFileSync(new URL("./storefrontPaths.ts", import.meta.url), "utf8");
const backendSource = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/navigation-commerce.php", import.meta.url),
  "utf8",
);
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");

test("configured WordPress and WooCommerce legal pages feed the route registry", () => {
  assert.match(pathsSource, /isPrivacyPage/);
  assert.match(backendSource, /get_option\( 'woocommerce_terms_page_id'/);
  assert.match(backendSource, /pll_get_post_translations/);
  assert.match(pathsSource, /isPrivacyPage\s+isTermsPage/);
});

test("cookie consent and registration resolve legal links through shared special pages", () => {
  assert.match(prerenderSource, /resolveStaticSpecialPagePath\("privacy-policy", route\.lang\)/);
  assert.match(authSource, /useStorefrontPath\("privacy-policy", "\/privacy-policy"\)/);
  assert.match(authSource, /useStorefrontPath\("terms", "\/terms"\)/);
  assert.match(authSource, /privacyPolicyPath=\{privacyPolicyPath\}/);
  assert.match(authSource, /termsPath=\{termsPath\}/);
});
