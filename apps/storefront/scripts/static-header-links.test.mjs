import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prerenderSource = readFileSync(new URL("prerender.mjs", import.meta.url), "utf8");

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `expected to find function ${name}`);
  let depth = 0;
  let bodyStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      if (bodyStart === -1) bodyStart = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`could not find end of function ${name}`);
}

test("the static route registry is populated before per-route rendering starts", () => {
  assert.match(
    prerenderSource,
    /let staticRouteRegistryEntries = \[\];/,
  );
  assert.match(
    prerenderSource,
    /staticRouteRegistryEntries = buildStaticRouteRegistryEntries\(routes\);[\s\S]*?for \(const route of routes\) \{/,
  );
});

test("the static desktop header resolves account/reading-list/wishlist links from the authoritative route registry, not a guessed slug", () => {
  const controls = extractFunctionSource(prerenderSource, "renderStaticHeaderControls");
  assert.match(controls, /resolveStaticSpecialPageLinks\(route, chromeConfig\)/);
  assert.doesNotMatch(controls, /normalizeLanguageRoutePath\("\/account"/);
  assert.doesNotMatch(controls, /normalizeLanguageRoutePath\("\/reading-list"/);
  assert.doesNotMatch(controls, /normalizeLanguageRoutePath\("\/wishlist"/);
});

test("resolveStaticSpecialPagePath consults the build-time route registry before guessing a slug", () => {
  const resolver = extractFunctionSource(prerenderSource, "resolveStaticSpecialPagePath");
  assert.match(resolver, /resolveStaticRouteRegistryPath\(staticRouteRegistryEntries, key, languageCode, fallback\)/);
});

test("resolveStaticSpecialPageLinks excludes personalized state and mirrors the React header's enabled flags and order", () => {
  const links = extractFunctionSource(prerenderSource, "resolveStaticSpecialPageLinks");
  const accountIndex = links.indexOf('role: "account"');
  const readingListIndex = links.indexOf('role: "reading-list"');
  const wishlistIndex = links.indexOf('role: "wishlist"');
  assert.ok(accountIndex > -1 && readingListIndex > accountIndex && wishlistIndex > readingListIndex);
  assert.match(links, /showHeaderAccountLink, controls\.features\.account/);
  assert.match(links, /showHeaderReadingListLink, controls\.features\.readingList/);
  assert.match(links, /showHeaderWishlistLink, controls\.features\.wishlist/);
  // No badge counts, sync-error indicators, or auth-conditional rendering —
  // those only exist once React hydrates with real per-user data.
  assert.doesNotMatch(links, /readingListCount|wishlistCount|SyncError|isLoggedIn|viewer\?\./);
});

test("the static mobile drawer renders the same authoritative special-page links as the desktop header", () => {
  assert.match(
    prerenderSource,
    /function renderStaticMobileNavigation\([\s\S]*?specialPageLinks = \[\],[\s\S]*?\) \{/,
  );
  const chrome = extractFunctionSource(prerenderSource, "renderStaticChrome");
  assert.match(
    chrome,
    /renderStaticMobileNavigation\([\s\S]*?mobileNavigationItems,[\s\S]*?resolveStaticSpecialPageLinks\(route, chromeConfig\)/,
  );
  const mobileNavigation = extractFunctionSource(prerenderSource, "renderStaticMobileNavigation");
  assert.match(mobileNavigation, /renderStaticMobileActionLinks\(specialPageLinks, chromeConfig, languageCode\)/);
});
