import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/", import.meta.url);
const controlCenter = readFileSync(new URL("inc/control-center.php", themeRoot), "utf8");
const submissions = readFileSync(new URL("inc/submissions.php", themeRoot), "utf8");
const licenceClient = readFileSync(new URL("inc/superfunky-licence-client.php", themeRoot), "utf8");
const viewLinks = readFileSync(new URL("inc/admin-view-links.php", themeRoot), "utf8");
const freePluginRoots = [
  "admin-dark-mode",
  "auto-assign-guest-orders",
  "funkycommerce-headless-dependencies",
  "macos-dots-pro",
  "page-menu-organizer",
].map(
  (slug) =>
    new URL(
      `../../../../../backend/wordpress/plugins/free/${slug}/`,
      import.meta.url,
    ),
);

test("registers theme-owned screens below top-level Superfunky", () => {
  assert.match(controlCenter, /add_menu_page\([\s\S]*Superfunky[\s\S]*,\s*59\s*\)/);
  assert.match(controlCenter, /add_submenu_page\(\s*'funkycommerce-control-center'/);
  assert.match(submissions, /add_submenu_page\(\s*'funkycommerce-control-center'/);
  assert.match(licenceClient, /add_submenu_page\(\s*'funkycommerce-control-center'/);
  assert.doesNotMatch(submissions, /add_theme_page\(/);
  assert.doesNotMatch(licenceClient, /add_options_page\(/);
});

test("keeps old Appearance and Settings URLs working through redirects", () => {
  assert.match(controlCenter, /'themes\.php'\s*=>/);
  assert.match(controlCenter, /'options-general\.php'\s*=>/);
  assert.match(controlCenter, /admin_url\( 'admin\.php' \)/);
});

test("rate-limits automatic licence validation to once per product each day", () => {
  assert.match(licenceClient, /const VALIDATION_INTERVAL = 86400;/);
  assert.match(
    licenceClient,
    /validation_is_due[\s\S]*last_attempt[\s\S]*self::VALIDATION_INTERVAL/,
  );
  assert.match(
    licenceClient,
    /validate_installation\( \$product_id = self::PRODUCT_ID, \$timeout = 8, \$force = false \)/,
  );
  assert.match(
    licenceClient,
    /if \( ! \$force && ! self::validation_is_due\( \$product_id \) \)/,
  );
  assert.match(
    licenceClient,
    /acquire_validation_lock[\s\S]*add_option\( \$lock_name, \$now, '', false \)/,
  );
  assert.match(
    licenceClient,
    /handle_recheck\(\)[\s\S]*validate_installation\( \$product_id, 10, true \)/,
  );
  assert.match(
    licenceClient,
    /daily_validation\(\)[\s\S]*self::validation_is_due\( \$product_id \)/,
  );
  assert.match(
    licenceClient,
    /maybe_refresh_in_admin\(\)[\s\S]*self::validation_is_due\( \$product_id \)/,
  );
  assert.doesNotMatch(licenceClient, /12 \* HOUR_IN_SECONDS/);
});

test("keeps licence checks out of standalone free plugins", () => {
  for (const pluginRoot of freePluginRoots) {
    const slug = pluginRoot.pathname.split("/").filter(Boolean).at(-1);
    assert.ok(slug);
    const bootstrap = readFileSync(new URL(`${slug}.php`, pluginRoot), "utf8");
    assert.equal(
      existsSync(new URL("includes/superfunky-licence-client.php", pluginRoot)),
      false,
    );
    const updater = readFileSync(
      new URL("includes/superfunky-update-client.php", pluginRoot),
      "utf8",
    );

    assert.doesNotMatch(bootstrap, /superfunky-licence-client/);
    assert.doesNotMatch(bootstrap, /Superfunky_Licence_Client/);
    assert.doesNotMatch(updater, /Superfunky_Licence_Client::api_(?:url|request)/);
    assert.match(updater, /Superfunky_Release_Client::api_request/);
  }
});

test("maps archive View links to supported storefront routes", () => {
  assert.match(viewLinks, /'post' === \$post->post_type[\s\S]*'blog\/'/);
  assert.match(viewLinks, /'product' === \$post->post_type[\s\S]*'shop\/'/);
  assert.match(viewLinks, /'community_post' === \$post->post_type[\s\S]*'community_post\/'/);
  assert.match(viewLinks, /get_page_uri\( \$post \)/);
  assert.match(viewLinks, /pll_get_post_language/);
  assert.match(viewLinks, /wp_http_validate_url/);
  assert.match(viewLinks, /get_permalink/);
  assert.match(viewLinks, /add_filter\( 'post_row_actions'/);
  assert.match(viewLinks, /add_filter\( 'page_row_actions'/);
});
