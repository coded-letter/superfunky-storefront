import assert from "node:assert/strict";
import test from "node:test";
import { mapBackendLanguages } from "./languageMapping.ts";
import { shouldRenderLanguageSwitcher } from "../../../../packages/ui/src/locale/options.ts";
import {
  languageHomePath,
  resolveCanonicalLanguageRoute,
  normalizeLanguagePath,
  resolveCanonicalLanguagePath,
  resolveLanguageUrlAction,
} from "../../../../packages/ui/src/locale/urlPaths.ts";
import { parseSpotifyReference } from "../../../../packages/ui/src/layout/spotifyEmbed.ts";
import {
  getContentLanguageFallbackCandidates,
  resolveContentLanguageFallback,
} from "./contentLanguageFallback.ts";
import { resolveRouteLanguageSync } from "./contentRouteLanguageSync.ts";

test("maps backend EN and JA records without deriving enum values from slugs", () => {
  assert.deepEqual(
    mapBackendLanguages([
      { code: "EN", name: "English", slug: "en" },
      { code: "JA", name: "日本語", slug: "ja" },
    ]),
    [
      { code: "en", label: "English", backendCode: "EN" },
      { code: "ja", label: "日本語", backendCode: "JA" },
    ],
  );
  assert.equal(languageHomePath("ja", ["en", "ja"]), "/ja");
});

test("route language synchronization stays suspended until a selected-language navigation completes", () => {
  const selection = resolveRouteLanguageSync(null, "/koszyk/", true);
  assert.deepEqual(selection, {
    pendingSelectionPath: "/koszyk/",
    shouldSynchronizeRouteLanguage: false,
  });
  assert.deepEqual(
    resolveRouteLanguageSync(selection.pendingSelectionPath, "/koszyk/", false),
    selection,
  );
  assert.deepEqual(
    resolveRouteLanguageSync(selection.pendingSelectionPath, "/en/cart/", false),
    {
      pendingSelectionPath: null,
      shouldSynchronizeRouteLanguage: true,
    },
  );
});

test("zero and one configured language keep every storefront surface unprefixed", () => {
  const paths = [
    "/", "/about/", "/cart/", "/checkout/", "/product/widget/", "/pro-category/plugins/",
    "/pro-tag/sale/", "/search/?q=hat", "/account/", "/documentation/en-guide/",
  ];
  for (const configured of [[], ["en"]] as const) {
    for (const path of paths) {
      assert.equal(normalizeLanguagePath(path, "en", configured), path);
    }
  }
  assert.equal(normalizeLanguagePath("/en/cart/", "en", ["en"]), "/cart/");
  assert.equal(normalizeLanguagePath("/en/pro-category/plugins/", "en", ["en"]), "/pro-category/plugins/");
  assert.equal(languageHomePath("en", []), "/");
  assert.equal(languageHomePath("en", ["en"]), "/");
});

test("two configured languages prefix generated routes without stripping legitimate slugs", () => {
  assert.equal(normalizeLanguagePath("/", "ja", ["en", "ja"]), "/ja");
  assert.equal(normalizeLanguagePath("/cart/", "en", ["en", "ja"]), "/en/cart/");
  assert.equal(normalizeLanguagePath("/checkout/", "ja", ["en", "ja"]), "/ja/checkout/");
  assert.equal(normalizeLanguagePath("/pro-category/plugins/", "ja", ["en", "ja"]), "/ja/pro-category/plugins/");
  assert.equal(normalizeLanguagePath("/pro-tag/sale/", "en", ["en", "ja"]), "/en/pro-tag/sale/");
  assert.equal(normalizeLanguagePath("/de/about/", "en", ["en"]), "/de/about/");
  assert.equal(normalizeLanguagePath("/enigma/docs/", "en", ["en"]), "/enigma/docs/");
  assert.equal(normalizeLanguagePath("/order/1042", "pl", ["en", "pl"]), "/pl/order/1042");
  assert.equal(normalizeLanguagePath("/order/1042", "en", ["en"]), "/order/1042");
});

test("keeps admin tools language-independent and removes stale language prefixes", () => {
  for (const path of ["/shortcodes", "/shortcodes/", "/layout-studio?panel=footer#preview"]) {
    assert.equal(normalizeLanguagePath(path, "pl", ["en", "pl"]), path);
  }
  assert.equal(normalizeLanguagePath("/en/shortcodes/", "pl", ["en", "pl"]), "/shortcodes/");
  assert.equal(
    normalizeLanguagePath("/pl/layout-studio?panel=footer#preview", "en", ["en", "pl"]),
    "/layout-studio?panel=footer#preview",
  );
});

test("a language selection replaces the old URL prefix instead of reverting the selection", () => {
  assert.deepEqual(
    resolveLanguageUrlAction("/en/cart/?coupon=summer#totals", "pl", ["en", "pl"], true),
    { type: "navigate", to: "/pl/cart/?coupon=summer#totals" },
  );
});

test("URL navigation changes language while admin tools remain unprefixed", () => {
  assert.deepEqual(
    resolveLanguageUrlAction("/pl/cart/", "en", ["en", "pl"], false),
    { type: "set-language", languageCode: "pl" },
  );
  assert.deepEqual(
    resolveLanguageUrlAction("/pl/shortcodes", "pl", ["en", "pl"], false),
    { type: "navigate", to: "/shortcodes" },
  );
  assert.equal(resolveLanguageUrlAction("/layout-studio", "pl", ["en", "pl"], true), null);
});

test("does not rewrite unprefixed canonical CMS routes outside a language selection", () => {
  assert.equal(resolveLanguageUrlAction("/koszyk/", "pl", ["en", "pl"], false), null);
  assert.deepEqual(
    resolveLanguageUrlAction("/", "pl", ["en", "pl"], false),
    { type: "navigate", to: "/pl" },
  );
});

test("uses exact canonical CMS translation URIs and namespaces only shared home URIs", () => {
  const registry = [
    { key: "home", uri: "/", languageCode: "en" },
    { key: "home", uri: "/", languageCode: "pl" },
    { key: "cart", uri: "/en/cart", languageCode: "en" },
    { key: "cart", uri: "/koszyk", languageCode: "pl" },
  ];
  assert.equal(resolveCanonicalLanguagePath(registry, "cart", "en", ["en", "pl"], "/cart"), "/en/cart");
  assert.equal(resolveCanonicalLanguagePath(registry, "cart", "pl", ["en", "pl"], "/cart"), "/koszyk");
  assert.equal(resolveCanonicalLanguagePath(registry, "home", "en", ["en", "pl"], "/"), "/en");
  assert.equal(resolveCanonicalLanguagePath(registry, "home", "pl", ["en", "pl"], "/"), "/pl");
  assert.equal(resolveCanonicalLanguagePath([], "cart", "pl", ["en", "pl"], "/cart"), "/pl/cart");
});

test("resolves a language switch only from one unambiguous canonical route", () => {
  const registry = [
    { key: "cart", uri: "/en/cart/", languageCode: "en" },
    { key: "cart", uri: "/koszyk/", languageCode: "pl" },
    { key: "wishlist", uri: "/en/test/", languageCode: "en" },
    { key: "reading-list", uri: "/en/test/", languageCode: "en" },
  ];
  assert.deepEqual(
    resolveCanonicalLanguageRoute(registry, "/en/cart", "pl", ["en", "pl"]),
    { key: "cart", targetPath: "/koszyk/" },
  );
  assert.equal(
    resolveCanonicalLanguageRoute(registry, "/en/test/", "pl", ["en", "pl"]),
    null,
  );
});

test("recovers synthetic localized CMS paths through canonical translations", async () => {
  assert.deepEqual(
    getContentLanguageFallbackCandidates("/pl/english-only/", ["en", "pl"]),
    ["/en/english-only/", "/english-only/"],
  );

  const translatedPath = await resolveContentLanguageFallback(
    "/pl/test/",
    "pl",
    ["en", "pl"],
    {
      getPage: async (uri) => uri === "/en/test/"
        ? {
            uri: "/en/test/",
            languageCode: "en",
            translations: [{ languageCode: "pl", uri: "/tests-pl/" }],
          }
        : null,
      getNodeInfo: async () => null,
    },
  );
  assert.equal(translatedPath, "/tests-pl/");
});

test("falls back to the original CMS language when no translation exists", async () => {
  const originalPath = await resolveContentLanguageFallback(
    "/pl/english-only/",
    "pl",
    ["en", "pl"],
    {
      getPage: async (uri) => uri === "/en/english-only/"
        ? { uri, languageCode: "en", translations: [] }
        : null,
      getNodeInfo: async () => null,
    },
  );
  assert.equal(originalPath, "/en/english-only/");

  const originalPostPath = await resolveContentLanguageFallback(
    "/pl/english-post/",
    "pl",
    ["en", "pl"],
    {
      getPage: async () => null,
      getNodeInfo: async (uri) => uri === "/en/english-post/" ? { type: "Post" } : null,
    },
  );
  assert.equal(originalPostPath, "/en/english-post/");
});

test("preserves PL when the backend genuinely advertises it", () => {
  assert.deepEqual(
    mapBackendLanguages([
      { code: "EN", name: "English", slug: "en" },
      { code: "PL", name: "Polski", slug: "pl" },
    ])[1],
    { code: "pl", label: "Polski", backendCode: "PL" },
  );
});

test("shows language controls only for two or more backend languages", () => {
  const language = { code: "en", label: "English", flagCode: "EN", backendCode: "EN" };
  assert.equal(shouldRenderLanguageSwitcher([]), false);
  assert.equal(shouldRenderLanguageSwitcher([language]), false);
  assert.equal(shouldRenderLanguageSwitcher([language, { ...language, code: "pl" }]), true);
});

test("accepts valid Spotify references and rejects unconfigured or unsafe URLs", () => {
  assert.deepEqual(parseSpotifyReference("spotify:playlist:37i9dQZF1DWWQRwui0ExPn"), {
    contentType: "playlist",
    id: "37i9dQZF1DWWQRwui0ExPn",
  });
  assert.deepEqual(parseSpotifyReference("https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl?si=test"), {
    contentType: "track",
    id: "11dFghVXANMlKmJXsNCbNl",
  });
  assert.equal(parseSpotifyReference("https://example.com/track/11dFghVXANMlKmJXsNCbNl"), null);
  assert.equal(parseSpotifyReference(""), null);
});
