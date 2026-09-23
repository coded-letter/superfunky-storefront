import assert from "node:assert/strict";
import test from "node:test";
import { assertStaticHydrationAssets, requiredStaticHydrationNames } from "./static-hydration-policy.mjs";

test("home and shop require their content seeds, not only the page HTML", () => {
  const markup = '<div data-funkycommerce-shortcode="grid" data-type="product"></div>';
  assert.deepEqual(requiredStaticHydrationNames("full", "/", markup),
    ["navigation", "archiveSettings", "commerce", "blogSummary"]);
  assert.deepEqual(requiredStaticHydrationNames("full", "/shop/", markup),
    ["navigation", "archiveSettings", "commerce"]);
  assert.deepEqual(requiredStaticHydrationNames("full", "/about/", "<p>About</p>"),
    ["navigation", "archiveSettings"]);
  assert.deepEqual(requiredStaticHydrationNames("shop", "/account/"),
    ["navigation", "archiveSettings"]);
  assert.deepEqual(requiredStaticHydrationNames("shell", "/blog/"),
    ["navigation", "archiveSettings"]);
});

test("missing critical hydration blocks deployment rather than publishing loading placeholders", () => {
  const routes = [{ path: "/shop/", lang: "en" }];
  assert.throws(() => assertStaticHydrationAssets("full", routes, new Map()), /navigation, archiveSettings, commerce/);
  const assets = new Map([["en", { navigation: "nav.json", archiveSettings: "settings.json" }]]);
  assert.throws(() => assertStaticHydrationAssets("full", routes, assets), /missing required seeds: commerce/);
  assets.get("en").commerce = "catalog.json";
  assert.doesNotThrow(() => assertStaticHydrationAssets("full", routes, assets));
  assert.throws(() => assertStaticHydrationAssets("full", [{ path: "/pl/shop/", lang: "pl" }], assets), /missing required seeds/);
});
