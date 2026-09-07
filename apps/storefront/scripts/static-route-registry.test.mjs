import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStaticRouteRegistryEntries,
  resolveStaticRouteRegistryPath,
} from "./static-route-registry.mjs";

function cmsRoute(path, lang, overrides = {}) {
  return {
    path,
    lang,
    cmsPage: {
      uri: overrides.uri ?? `${path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`}`,
      slug: overrides.slug ?? (path.replace(/^\/+/, "").replace(/\/+$/, "") || "home"),
      languageCode: lang,
      headlessShortcodes: overrides.headlessShortcodes ?? [],
      ...overrides,
    },
  };
}

test("buildStaticRouteRegistryEntries classifies configured special pages from build-time routes", () => {
  const routes = [
    cmsRoute("/en/moje-konto", "en", { headlessShortcodes: ["[account]"] }),
    cmsRoute("/pl/moje-konto", "pl", { headlessShortcodes: ["[account]"] }),
    cmsRoute("/en/wishlist", "en", { headlessShortcodes: ["[wishlist]"] }),
    // Non-page routes (no cmsPage, e.g. product/community routes) are ignored.
    { path: "/en/product/widget", lang: "en" },
  ];

  const entries = buildStaticRouteRegistryEntries(routes);

  assert.deepEqual(
    entries.filter((entry) => entry.key === "account").map((entry) => [entry.languageCode, entry.uri]),
    [["en", "/en/moje-konto/"], ["pl", "/pl/moje-konto/"]],
  );
  assert.deepEqual(
    entries.filter((entry) => entry.key === "wishlist").map((entry) => [entry.languageCode, entry.uri]),
    [["en", "/en/wishlist/"]],
  );
});

test("resolveStaticRouteRegistryPath prefers the exact language match", () => {
  const entries = [
    { key: "account", uri: "/en/moje-konto/", languageCode: "en" },
    { key: "account", uri: "/pl/moje-konto/", languageCode: "pl" },
  ];

  assert.equal(
    resolveStaticRouteRegistryPath(entries, "account", "pl", "/pl/account/"),
    "/pl/moje-konto/",
  );
});

test("resolveStaticRouteRegistryPath falls back to English, then any match, then the fallback", () => {
  const englishOnly = [{ key: "wishlist", uri: "/en/wishlist/", languageCode: "en" }];
  assert.equal(
    resolveStaticRouteRegistryPath(englishOnly, "wishlist", "ja", "/ja/wishlist/"),
    "/en/wishlist/",
  );

  const otherLanguageOnly = [{ key: "wishlist", uri: "/de/wunschliste/", languageCode: "de" }];
  assert.equal(
    resolveStaticRouteRegistryPath(otherLanguageOnly, "wishlist", "ja", "/ja/wishlist/"),
    "/de/wunschliste/",
  );

  assert.equal(
    resolveStaticRouteRegistryPath([], "wishlist", "ja", "/ja/wishlist/"),
    "/ja/wishlist/",
  );
});
