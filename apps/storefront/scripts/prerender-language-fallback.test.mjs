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
