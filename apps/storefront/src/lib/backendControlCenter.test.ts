import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/",
  import.meta.url,
);
const schemaSource = readFileSync(new URL("inc/control-center-schema.php", themeRoot), "utf8");
const controlSource = readFileSync(new URL("inc/control-center.php", themeRoot), "utf8");
const commerceSource = readFileSync(new URL("inc/navigation-commerce.php", themeRoot), "utf8");
const webPushSource = readFileSync(new URL("inc/web-push.php", themeRoot), "utf8");
const securitySource = readFileSync(new URL("inc/security-hardening.php", themeRoot), "utf8");
const adminThemeSource = readFileSync(new URL("inc/admin-theme.php", themeRoot), "utf8");
const buildWebhookSource = readFileSync(new URL("inc/build-webhooks.php", themeRoot), "utf8");
const functionsSource = readFileSync(new URL("functions.php", themeRoot), "utf8");
const postsSource = readFileSync(new URL("posts.ts", import.meta.url), "utf8");
const pagesSource = readFileSync(new URL("pages.ts", import.meta.url), "utf8");
const storefrontCommerceSource = readFileSync(new URL("commerce.ts", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("navigation.ts", import.meta.url), "utf8");
const graphqlClientSource = readFileSync(
  new URL("../../../../packages/sdk/src/graphqlClient.ts", import.meta.url),
  "utf8",
);
const accountSource = readFileSync(new URL("../pages/AccountMockupPage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const pushSource = readFileSync(new URL("push.ts", import.meta.url), "utf8");
const headerSource = readFileSync(
  new URL("../../../../packages/ui/src/layout/HeaderMockup.tsx", import.meta.url),
  "utf8",
);
const footerSource = readFileSync(
  new URL("../../../../packages/ui/src/layout/FooterMockup.tsx", import.meta.url),
  "utf8",
);
const productCardSource = readFileSync(
  new URL("../../../../packages/ui/src/catalog/ProductCard.tsx", import.meta.url),
  "utf8",
);
const abandonedCartsSource = readFileSync(
  new URL("../../../../../backend/wordpress/plugins/paid/funkycommerce-abandoned-carts/funkycommerce-abandoned-carts.php", import.meta.url),
  "utf8",
);
const productPriceModeSource = readFileSync(new URL("productPriceMode.ts", import.meta.url), "utf8");
const productInquirySource = readFileSync(new URL("productInquiry.ts", import.meta.url), "utf8");
const productMockupPageSource = readFileSync(new URL("../pages/ProductMockupPage.tsx", import.meta.url), "utf8");
const productInquiryFormSource = readFileSync(
  new URL("../components/ProductInquiryForm.tsx", import.meta.url),
  "utf8",
);
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const storefrontChromeSource = readFileSync(
  new URL("../../../../packages/ui/src/layout/StorefrontChromeMockup.tsx", import.meta.url),
  "utf8",
);
const codeHighlightingSource = readFileSync(new URL("codeHighlighting.ts", import.meta.url), "utf8");
const codeThemesSource = readFileSync(new URL("codeThemes.ts", import.meta.url), "utf8");
const codeThemeStylesSource = readFileSync(new URL("codeThemeStyles.ts", import.meta.url), "utf8");
const frontendThemeSource = readFileSync(new URL("inc/frontend-theme.php", themeRoot), "utf8");
const nativeThemeScriptSource = readFileSync(new URL("assets/js/theme.js", themeRoot), "utf8");
const footerPartSource = readFileSync(new URL("parts/footer.html", themeRoot), "utf8");
const communitySource = readFileSync(new URL("inc/community.php", themeRoot), "utf8");
const multilingualSource = readFileSync(new URL("inc/multilingual-content.php", themeRoot), "utf8");

test("abandoned-carts companion matching accepts metadata arrays without string coercion", () => {
  assert.match(abandonedCartsSource, /private function matches_companion/);
  assert.match(abandonedCartsSource, /is_array\( \$plugin \)/);
  assert.doesNotMatch(abandonedCartsSource, /\(string\) \$plugin_file/);
});

test("native Code blocks expose supported highlighting languages in the editor", () => {
  assert.match(adminThemeSource, /enqueue_block_editor_assets/);
  assert.match(adminThemeSource, /blocks\.registerBlockType/);
  assert.match(adminThemeSource, /blocks\.getSaveContent\.extraProps/);
  assert.match(adminThemeSource, /data-code-language/);
  assert.match(adminThemeSource, /language-(?:' \+ attributes\.language|\$\{)/);
  assert.match(adminThemeSource, /FUNKYCOMMERCE_HEADLESS_VERSION/);
  assert.match(stylesSource, /pre\[data-code-language\]::before/);
  assert.match(stylesSource, /content: attr\(data-code-language\)/);
});

test("Code blocks expose every bundled Prism color mode through deferred per-block controls", () => {
  for (const mode of [
    "one-light",
    "one-dark",
    "dracula",
    "duotone-light",
    "duotone-dark",
    "prism",
    "coy",
    "dark",
    "funky",
    "okaidia",
    "solarized-light",
    "tomorrow",
    "twilight",
  ]) {
    assert.match(codeThemesSource, new RegExp(`value: "${mode}"`));
    assert.match(adminThemeSource, new RegExp(`value: '${mode}'`));
    assert.match(schemaSource, new RegExp(`'${mode}'\\s*=>`));
  }
  assert.match(adminThemeSource, /data-code-theme/);
  assert.match(adminThemeSource, /attributes\.theme && attributes\.theme !== 'auto'/);
  assert.match(adminThemeSource, /if \(attributes\.language\) nextProps\['data-code-language'\]/);
  assert.match(codeHighlightingSource, /cms-code-theme-select/);
  assert.match(codeHighlightingSource, /import\("\.\/codeThemeStyles\.ts"\)/);
  assert.match(codeThemeStylesSource, /data-cms-code-theme-styles/);
  assert.doesNotMatch(headerSource, /CodeHighlightThemeSwitcher|sf-code-theme-switcher/);
});

test("Spotify content and radio copy map through the backend to the storefront", () => {
  assert.match(controlSource, /open\.spotify\.com/);
  assert.match(controlSource, /track\|album\|playlist\|artist\|show\|episode/);
  assert.match(controlSource, /spotifyPlaylistUrl[\s\S]*funkycommerce_normalize_spotify_playlist_url/);
  assert.match(controlSource, /spotifyPlaylistEmbedUrl[\s\S]*funkycommerce_spotify_playlist_embed_url/);
  assert.match(controlSource, /spotifyPlayerTitle[\s\S]*spotify_player_title/);
  assert.match(controlSource, /spotifyPlayerDescription[\s\S]*spotify_player_description/);
  assert.match(navigationSource, /spotifyPlaylistUrl[\s\S]*spotifyPlayerDescription/);
  assert.match(storefrontChromeSource, /spotifyPlaylistUrl[\s\S]*spotifyPlaylistEmbedUrl/);
  assert.match(storefrontChromeSource, /showSpotifyPlayer=\{showFooterSpotifyPlayer && Boolean\(spotifyPlaylistUrl\)\}/);
  assert.match(storefrontChromeSource, /spotifyPlayerTitle=\{storefrontConfig\?\.footer\?\.spotifyPlayerTitle \|\| undefined\}/);
  assert.match(storefrontChromeSource, /spotifyPlayerProps=\{spotifyPlaylistUrl \? \{ uri: spotifyPlaylistUrl \} : undefined\}/);
  assert.match(frontendThemeSource, /data-funky-spotify-embed=/);
  assert.match(frontendThemeSource, /footer\.radio\.title/);
  assert.match(frontendThemeSource, /spotifyPlayerDescription/);
  assert.match(footerPartSource, /data-funky-spotify-embed=""/);
  assert.match(nativeThemeScriptSource, /embedUrl\.protocol !== "https:"/);
  assert.match(nativeThemeScriptSource, /track\|album\|playlist\|artist\|show\|episode/);
  assert.match(nativeThemeScriptSource, /slot\.replaceChildren\(\.\.\.content\)/);
  assert.match(nativeThemeScriptSource, /embedUrl\.hostname !== "open\.spotify\.com"/);
  assert.match(nativeThemeScriptSource, /slot\.querySelector\("iframe"\)/);
});

test("footer integration scripts flow from Control Center into generated pages", () => {
  assert.match(schemaSource, /'footer_scripts'/);
  assert.match(buildWebhookSource, /'footerScripts'\s*=>/);
  assert.match(prerenderSource, /staticGenerationConfig\.footerScripts/);
  assert.match(prerenderSource, /<\/body>/);
});

test("Control Center saves return administrators to the active tab", () => {
  assert.match(controlSource, /settings_errors\( 'funkycommerce_control_center' \)/);
  assert.match(controlSource, /sessionStorage\.setItem\(tabStorageKey, activeTab\.dataset\.tab\)/);
  assert.match(controlSource, /sessionStorage\.getItem\(tabStorageKey\)/);
  assert.match(schemaSource, /'apple_touch_url'[\s\S]*?'autocomplete' => 'off'/);
});

test("Stripe and theme licensing use their native plugin owners", () => {
  assert.doesNotMatch(schemaSource, /'stripe_publishable_key'\s*=>/);
  assert.doesNotMatch(schemaSource, /'license_key'\s*=>.*Pro licence key/);
  assert.match(commerceSource, /get_option\( 'woocommerce_stripe_settings'/);
  assert.doesNotMatch(commerceSource, /\$control_settings\['stripe_publishable_key'\]/);
});

test("shipping JSON controls document valid country and threshold examples", () => {
  assert.match(schemaSource, /countryCode":"DE","cost":9\.90/);
  assert.match(schemaSource, /countryCode":"DE","minAmount":60/);
});

test("engagement configuration is sanitized, typed, and consumed by storefront surfaces", () => {
  for (const key of [
    "stripe_customer_portal_url",
    "products_no_price_behavior",
    "product_inquiry_heading",
    "product_inquiry_button_label",
    "product_inquiry_copy",
    "product_card_quick_view",
    "prism_theme_light",
    "prism_theme_dark",
  ]) {
    assert.match(schemaSource, new RegExp(`'${key}'`));
    assert.match(controlSource, new RegExp(`'${key}'`));
  }
  assert.match(schemaSource, /'promo_text'[\s\S]*?'type' => 'textarea'[\s\S]*?'sanitize' => 'html'/);
  assert.match(controlSource, /'promo_text_' \. \$language \]\s+= wp_kses_post/);
  assert.match(controlSource, /'promoHtml'\s+=>/);
  assert.match(controlSource, /'extraHtml'\s+=>/);
  assert.match(controlSource, /'copyrightText'\s+=>/);
  assert.match(commerceSource, /'stripeCustomerPortalUrl'/);
  assert.match(commerceSource, /'FunkyCommerceProductPresentation'/);
  assert.match(commerceSource, /'FunkyCommerceCodeHighlighting'/);
  assert.match(navigationSource, /stripeCustomerPortalUrl/);
  assert.match(navigationSource, /promoHtml/);
  assert.match(navigationSource, /quickView/);
  assert.match(navigationSource, /promoHtml: ""/);
  assert.match(navigationSource, /extraHtml: ""/);
  assert.match(navigationSource, /copyrightText: ""/);
  assert.match(navigationSource, /normalizeExternalHttpUrl\(configuration\.stripeCustomerPortalUrl\)/);
  assert.match(accountSource, /href=\{customerPortalUrl\}/);
  assert.match(accountSource, /rel="noopener noreferrer"/);
  assert.match(headerSource, /SafeHtmlContent/);
  assert.match(footerSource, /safeExtraWrapperHtml/);
  assert.match(footerSource, /showCopyright && visibleCopyrightText/);
  assert.match(productCardSource, /quickViewEnabled && variant/);
  assert.match(productCardSource, /navigate\(product\.href/);
});

test("security controls sanitize SVG uploads and scope executable editor scripts", () => {
  assert.match(schemaSource, /'svg_upload_enabled'/);
  assert.match(schemaSource, /'content_scripts_posts_enabled'[\s\S]*'tier'\s*=>\s*'free'[\s\S]*'default'\s*=>\s*'no'/);
  assert.match(schemaSource, /'content_scripts_pages_enabled'[\s\S]*'tier'\s*=>\s*'free'[\s\S]*'default'\s*=>\s*'no'/);
  assert.match(schemaSource, /'content_scripts_products_enabled'[\s\S]*'tier'\s*=>\s*'pro'[\s\S]*'default'\s*=>\s*'no'/);
  assert.match(controlSource, /legacy_script_scope[\s\S]*content_script_scope[\s\S]*array\( 'all', \$post_type \)/);
  assert.match(securitySource, /function funkycommerce_security_sanitize_svg/);
  assert.match(securitySource, /LIBXML_NONET/);
  assert.match(securitySource, /add_filter\( 'wp_handle_upload_prefilter'/);
  assert.match(securitySource, /add_filter\( 'wp_handle_sideload_prefilter'/);
  assert.match(securitySource, /function funkycommerce_security_content_scripts_allowed/);
  assert.match(securitySource, /get_post_type_object\( \$post_type \)/);
  assert.match(securitySource, /function funkycommerce_security_mark_content_scripts\( \$content, \$post_type = '' \)/);
  assert.match(securitySource, /data-wp-block-html="js"/);
  assert.match(securitySource, /add_filter\( 'wp_kses_allowed_html'/);
  assert.match(functionsSource, /'Post',\s*'headlessContent'/);
  assert.match(functionsSource, /'Product',\s*'headlessDescription'/);
  assert.match(functionsSource, /'Product',\s*'headlessShortDescription'/);
  assert.match(functionsSource, /funkycommerce_security_mark_content_scripts\( \$content, \$post_type \)/);
  assert.match(postsSource, /content: post\.headlessContent \|\| post\.content/);
  assert.match(postsSource, /POST_COMPATIBILITY_RULES/);
  assert.match(postsSource, /requestGraphqlWithCompatibility/);
  assert.match(pagesSource, /PAGE_COMPATIBILITY_RULES/);
  assert.match(pagesSource, /missingGraphqlFieldRule\("language"\)/);
  assert.match(functionsSource, /function funkycommerce_with_headless_shortcode_markers\( \$callback \)/);
  assert.match(functionsSource, /function funkycommerce_render_headless_page_content\( \$page_id \)/);
  assert.match(functionsSource, /funkycommerce_render_content_shortcode_marker/);
  assert.match(functionsSource, /try \{\s*return call_user_func\( \$callback \);\s*\} finally \{/);
  assert.match(functionsSource, /funkycommerce_render_headless_content_field[\s\S]*funkycommerce_with_headless_shortcode_markers/);
  assert.match(pagesSource, /missingGraphqlFieldRule\("translations"\)/);
  assert.match(pagesSource, /missingGraphqlFieldRule\("seo"\)/);
  assert.match(pagesSource, /requestGraphqlWithCompatibility/);
  assert.match(storefrontCommerceSource, /shortDescriptionHtml: product\.headlessShortDescription \|\| product\.shortDescription/);
  assert.match(storefrontCommerceSource, /descriptionHtml: product\.headlessDescription \|\| product\.description/);
  assert.match(storefrontCommerceSource, /COMPATIBLE_PRODUCT_DETAIL_QUERY/);
  assert.match(storefrontCommerceSource, /COMPATIBLE_CATALOG_OPERATIONS/);
  assert.match(storefrontCommerceSource, /requestCatalogWithFallback/);
  assert.match(storefrontCommerceSource, /isMissingProductOptionalFieldSchemaError/);
  const compatibleProductQuery = storefrontCommerceSource.match(
    /const COMPATIBLE_PRODUCT_DETAIL_QUERY =[\s\S]*?(?=\nconst PRODUCT_REVIEWS_QUERY)/,
  )?.[0] || "";
  assert.notEqual(compatibleProductQuery, "");
  assert.match(compatibleProductQuery, /createCompatibleProductDetailQuery\([\s\S]*PRODUCT_DETAIL_QUERY/);
  assert.match(storefrontCommerceSource, /requestCommerceWithFallback/);
  assert.match(storefrontCommerceSource, /usesCompatibilityFallback: usesSourceLanguageFallback/);
  assert.match(storefrontCommerceSource, /usesSourceLanguageFallback \? COMMERCE_SOURCE_LANGUAGE : languageCodeUsed/);
  assert.match(graphqlClientSource, /hasOnlyMissingGraphqlFields/);
});

test("per-product price-behavior override is stored, editable, and exposed alongside the store-wide setting", () => {
  // Backend: meta storage, product editor control, and GraphQL exposure.
  assert.match(commerceSource, /function funkycommerce_sanitize_price_behavior/);
  assert.match(commerceSource, /'_funkycommerce_price_behavior'/);
  assert.match(commerceSource, /woocommerce_wp_select/);
  assert.match(commerceSource, /add_action\( 'woocommerce_product_options_pricing', 'funkycommerce_product_price_behavior_field' \)/);
  assert.match(commerceSource, /add_action\( 'woocommerce_admin_process_product_object', 'funkycommerce_save_product_price_behavior' \)/);
  assert.match(commerceSource, /'Product',\s*\n\s*'priceBehavior'/);
  assert.match(commerceSource, /funkycommerce_sanitize_price_behavior\( get_post_meta\( \$product_id, '_funkycommerce_price_behavior', true \) \)/);

  // Frontend: the per-product field is queried, typed, and normalized alongside the card data.
  assert.match(storefrontCommerceSource, /priceBehavior/);
  assert.match(storefrontCommerceSource, /normalizeProductPriceBehavior\(product\.priceBehavior\)/);
  assert.match(productPriceModeSource, /export function resolveProductPriceMode/);
  assert.match(productPriceModeSource, /priceAmount === 0\) return "free"/);

  // Frontend: the product page resolves inquiry-vs-purchase and renders the inquiry form.
  assert.match(productMockupPageSource, /resolveProductPriceMode/);
  assert.match(productMockupPageSource, /ProductInquiryForm/);
  assert.match(productMockupPageSource, /priceMode === "inquiry"/);

  // Frontend: the inquiry form reuses the existing generic submission endpoint with product context.
  assert.match(productInquirySource, /submitFormSubmission/);
  assert.match(productInquirySource, /PRODUCT_INQUIRY_FORM_ID = "product-inquiry"/);
  assert.match(productInquirySource, /ProductId: product\.databaseId/);
  assert.match(productInquiryFormSource, /prefillFromCustomer/);
  assert.match(productInquiryFormSource, /authStore\.load\(\)\?\.user/);
});

test("web push supports guest and user subscriptions with observable failures", () => {
  assert.match(schemaSource, /'push_enabled'/);
  assert.match(schemaSource, /'push'\s*=>\s*array\(\s*'graphKey'\s*=>\s*'push',\s*'settingKey'\s*=>\s*'push'/);
  assert.match(commerceSource, /\/push\/subscribe/);
  assert.match(commerceSource, /\/push\/unsubscribe/);
  assert.match(commerceSource, /\/push\/preferences/);
  assert.match(commerceSource, /'user_id'\s*=>\s*get_current_user_id\(\)/);
  assert.match(commerceSource, /funkycommerce_render_push_admin_page/);
  assert.match(commerceSource, /funkycommerce_push_queue_delivery/);
  assert.doesNotMatch(commerceSource, /set_json_params/);
  assert.match(commerceSource, /woocommerce_order_status_changed/);
  assert.match(commerceSource, /transition_post_status/);
  assert.match(commerceSource, /funkycommerce_push_admin_subscription_summaries/);
  assert.match(commerceSource, /push_provider_unavailable/);
  assert.match(pushSource, /if \(response\.ok\) return;/);
  assert.match(pushSource, /throw new PushBackendError/);
  assert.doesNotMatch(pushSource, /fetch\([^;]+\.catch\(\(\) => undefined\)/s);
});

test("web push is a backend-configured header action with account category controls", () => {
  assert.match(controlSource, /\$icons\[\s*\$graph_key\s*\]\s*=\s*\(string\)\s*\(\s*\$settings\[\s*'header_icon_'\s*\.\s*\$setting_key\s*\]/);
  assert.match(controlSource, /'push'\s*=>\s*funkycommerce_is_pro\(\) && \$enabled\( 'push_enabled' \)/);
  assert.match(schemaSource, /\$settings = \(array\) get_option\( 'funkycommerce_control_center'[\s\S]+\$push_enabled = funkycommerce_is_pro\(\)/);
  assert.match(schemaSource, /'push' === \$setting_key && ! \$push_enabled[\s\S]+continue/);
  assert.doesNotMatch(schemaSource, /\$push_enabled\s*=\s*funkycommerce_push_is_enabled\(\)/);
  assert.match(webPushSource, /function funkycommerce_register_push_rest_routes\(\)\s*\{\s*if \( ! funkycommerce_push_is_enabled\(\) \) \{\s*return;/);
  assert.match(commerceSource, /function funkycommerce_register_push_engagement_routes\(\)\s*\{\s*if \( ! funkycommerce_push_engagement_is_enabled\(\) \) \{\s*return;/);
  assert.match(webPushSource, /function funkycommerce_register_push_hooks\(\)\s*\{\s*if \( ! funkycommerce_push_is_enabled\(\) \) \{\s*return;/);
  assert.match(commerceSource, /function funkycommerce_register_push_engagement_hooks\(\)\s*\{\s*if \( ! funkycommerce_push_engagement_is_enabled\(\) \) \{\s*return;/);
  assert.match(commerceSource, /add_action\( 'admin_menu', 'funkycommerce_add_push_admin_page', 20 \);/);
  assert.match(headerSource, /showPushAction/);
  assert.match(headerSource, /onPushToggle/);
  assert.match(headerSource, /name=\{pushSubscribed \? "bell-ring" : headerIcons\?\.push\}/);
  assert.match(headerSource, /mediaUrl=\{pushSubscribed \? null : headerIconMedia\?\.push\}/);
  assert.match(headerSource, /header\.push\.disable/);
  assert.match(appSource, /const pushEnabled = !isBackendConfigured \|\| data\?\.storefrontConfig\.features\.push === true/);
  assert.match(appSource, /if \(!navigationSettled \|\| !pushEnabled\)/);
  assert.doesNotMatch(
    appSource,
    /navigationSettled\s*=\s*!navigationLoading\s*&&\s*!navigationRevalidating/,
    "background navigation revalidation must not gate the static-first visible handoff",
  );
  assert.match(appSource, /onPushToggle=\{pushEnabled \? togglePush : undefined\}/);
  assert.match(accountSource, /const pushEnabled = useNavigationData\(\)\.data\?\.storefrontConfig\.features\.push === true/);
  assert.match(accountSource, /\{pushEnabled \? <PushNotificationsCard \/> : null\}/);
  assert.match(pushSource, /updatePushPreferences/);
});

test("storefront UI-string overrides integrate with optional Polylang and retain fallbacks", () => {
  assert.match(commerceSource, /function_exists\( 'pll_translate_string' \)/);
  assert.match(commerceSource, /pll_register_string/);
  assert.match(commerceSource, /funkycommerce_ui_strings_en/);
  assert.match(commerceSource, /funkycommerce_storefront_ui_strings_for_language/);
  assert.match(commerceSource, /assets\/storefront-ui-strings/);
  assert.match(commerceSource, /ui_strings_' \. \$language/);
  assert.match(commerceSource, /array_merge\(\s*\$clean\( \$versioned \),\s*\$overrides\s*\)/);
  assert.match(controlSource, /funkycommerce_storefront_ui_strings_for_language\( \$slug \)/);
  assert.match(navigationSource, /query StorefrontUiStrings\(\$language: String\)/);
  assert.match(navigationSource, /uiStringsResponse\.data\?\.uiStrings \?\? data\.uiStrings/);
  assert.match(navigationSource, /return mapNavigationLanguages\(await getOptionalPolylangRestLanguages\(\)\)/);
  assert.match(commerceSource, /array_merge\( \$defaults, \$overrides \)/);
  for (const locale of ["en", "pl", "ja"]) {
    const strings = JSON.parse(
      readFileSync(new URL(`assets/storefront-ui-strings/${locale}.json`, themeRoot), "utf8"),
    ) as Record<string, string>;
    assert.equal(Object.keys(strings).length, 395);
  }
});

test("JSON controls preserve valid raw backslashes before trying WordPress-unslashed input", () => {
  assert.match(controlSource, /json_decode\( \$submitted, true \);[\s\S]*JSON_ERROR_NONE === json_last_error\(\)[\s\S]*\$value = \$submitted/);
  assert.match(controlSource, /else \{[\s\S]*\$value = trim\( wp_unslash\( \$submitted \) \)/);
  assert.match(controlSource, /JSON_ERROR_NONE === json_last_error\(\)/);
});

test("theme GraphQL fallbacks do not duplicate fields supplied by active integrations", () => {
  assert.doesNotMatch(communitySource, /'Product',\s*'author'/);
  assert.match(multilingualSource, /! funkycommerce_wpgraphql_polylang_is_active\(\)/);
});
