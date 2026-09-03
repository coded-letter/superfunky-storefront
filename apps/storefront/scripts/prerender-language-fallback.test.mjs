import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prerenderSource = readFileSync(new URL("prerender.mjs", import.meta.url), "utf8");

test("prerender uses the WordPress site language when Polylang is unavailable", () => {
  assert.match(
    prerenderSource,
    /const STOREFRONT_CONFIG_LANGUAGES_QUERY[\s\S]*?funkycommerceStorefrontConfig[\s\S]*?languages \{ code name \}/,
  );
  assert.match(
    prerenderSource,
    /if \(!languages\.length\) \{[\s\S]*?STOREFRONT_CONFIG_LANGUAGES_QUERY[\s\S]*?backendCode: routeCode\.toUpperCase\(\)/,
  );
  assert.match(
    prerenderSource,
    /if \(!hasGraphqlLanguages && languages\[0\]\) \{\s*defaultLanguage = languages\[0\]\.routeCode/,
  );
  assert.match(prerenderSource, /backendLanguageFieldsAvailable = hasGraphqlLanguages/);
});

test("prerender retries commerce route discovery without multilingual WooCommerce metadata", () => {
  assert.match(
    prerenderSource,
    /!backendLanguageFieldsAvailable[\s\S]*?WPGraphQL route discovery failed with status 500/,
  );
  assert.match(
    prerenderSource,
    /WooCommerce multilingual route metadata is unavailable[\s\S]*?buildRoutesQuery\(\{[\s\S]*?commerce: false/,
  );
  assert.match(
    prerenderSource,
    /"WPGraphQL route discovery without commerce metadata"/,
  );
});
