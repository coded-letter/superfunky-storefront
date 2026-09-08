import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { staticNavHrefMatchesRoute } from "./static-navigation-route.mjs";

const prerenderSource = await readFile(new URL("./prerender.mjs", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const headerSource = await readFile(
  new URL("../../../packages/ui/src/layout/HeaderMockup.tsx", import.meta.url),
  "utf8",
);
const chromeSource = await readFile(
  new URL("../../../packages/ui/src/layout/StorefrontChromeMockup.tsx", import.meta.url),
  "utf8",
);

test("static navigation never marks fragment-only links as the active page", () => {
  assert.equal(staticNavHrefMatchesRoute("#details", "/"), false);
  assert.equal(staticNavHrefMatchesRoute("/account#orders", "/account"), false);
  assert.equal(staticNavHrefMatchesRoute("/account", "/account/"), true);
  assert.equal(
    staticNavHrefMatchesRoute("https://elsewhere.example/account", "/account", "https://store.example"),
    false,
  );
  assert.equal(
    staticNavHrefMatchesRoute("//elsewhere.example/account", "/account", "https://store.example"),
    false,
  );
});

test("static header uses the same authoritative navigation and layout seed as React", () => {
  assert.match(prerenderSource, /staticHydrationNavigationByLanguage\.set\(languageCode, navigationResult\.value\)/);
  assert.match(prerenderSource, /hydrationNavigation\?\.header\?\.length/);
  assert.match(prerenderSource, /hydrationNavigation\?\.mobile\?\.length/);
  for (const field of [
    "headerSticky",
    "headerLogoVariant",
    "headerArrangement",
    "showHeaderLogo",
    "mobileMenuWidth",
    "mobileMenuHeight",
  ]) {
    assert.match(prerenderSource, new RegExp(field));
  }
});

test("all static logo variants preserve React geometry and accessibility", () => {
  assert.match(prerenderSource, /logoVariant === "text"/);
  assert.match(prerenderSource, /logoVariant !== "image"/);
  assert.match(prerenderSource, /class="storefront-static-brand-logo"/);
  assert.match(prerenderSource, /hasBrandText \? "" : escapeAttribute\(chromeConfig\.storeName\)/);
  assert.match(prerenderSource, /staticHeaderIcon\("sparkles", "", "sparkles"\)/);
  assert.match(indexSource, /\.storefront-static-brand-logo \{[\s\S]*max-width: 12rem;[\s\S]*width: auto;/);
  assert.match(headerSource, /alt=\{logoVariant === "image" \? projectName : ""\}/);
});

test("inline static navigation does not retain the classic row offset", () => {
  assert.match(
    indexSource,
    /:is\(\.storefront-static-header--single-row, \.storefront-static-header--island\) nav \{[\s\S]*margin-left: 0;/,
  );
});

test("custom and preset icons keep the same stable 18px slot through handoff", () => {
  assert.match(prerenderSource, /assistant: "sparkles"/);
  assert.match(
    prerenderSource,
    /staticHeaderControl\("assistant", controls\.icons\.assistant, controls\.media\.assistant, "sparkles"\)/,
  );
  assert.match(
    prerenderSource,
    /sparkles: '<path d="M11\.017 2\.814[\s\S]*<circle cx="4" cy="20" r="2"\/>'/,
  );
  for (const icon of [
    "scan-search",
    "contrast",
    "sun-moon",
    "circle-user",
    "user-check",
    "bell-ring",
    "bookmark",
    "library",
    "star",
    "gift",
    "shopping-bag",
    "shopping-basket",
    "align-justify",
    "panels-top-left",
    "sparkles",
  ]) {
    assert.match(prerenderSource, new RegExp(`(?:["']${icon}["']|\\b${icon}:)`));
  }
  assert.match(prerenderSource, /class="storefront-static-icon-media"/);
  assert.match(prerenderSource, /data-static-icon-media/);
  assert.match(indexSource, /\.storefront-static-icon-media \{[\s\S]*height: 18px;[\s\S]*width: 18px;/);
  assert.match(headerSource, /useState\(\(\) => Boolean\(mediaUrl\)\)/);
  assert.match(chromeSource, /"account" \| "readingList"/);
});

test("critical CSS mirrors header arrangements, controls, and mobile drawer variants", () => {
  assert.match(indexSource, /z-index: 40;/);
  assert.match(indexSource, /\.storefront-static-header--centered \.storefront-static-header-row \{[\s\S]*display: grid;/);
  assert.match(indexSource, /storefront-static-header--single-row, \.storefront-static-header--island/);
  assert.match(indexSource, /\.storefront-static-control \{[\s\S]*height: 2\.5rem;[\s\S]*width: 2\.5rem;/);
  assert.match(indexSource, /\.storefront-static-mobile-drawer--standard \{[\s\S]*max-width: 85vw;[\s\S]*width: 20rem;/);
  assert.match(indexSource, /\.storefront-static-mobile-drawer--wide \{[\s\S]*width: 96vw;/);
  assert.match(indexSource, /\.storefront-static-mobile-drawer--full \{[\s\S]*width: 100vw;/);
  assert.match(indexSource, /\.storefront-static-mobile-drawer--content \{[\s\S]*max-height: 85vh;/);
  assert.match(prerenderSource, /storefront-static-mobile-drawer--\$\{width\} storefront-static-mobile-drawer--\$\{height\}/);
  assert.match(prerenderSource, /storefront-static-mobile-search/);
  assert.match(prerenderSource, /storefront-static-mobile-switchers/);
  assert.match(prerenderSource, /role: "cart"/);
});
