import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chromeSource = readFileSync(
  new URL("../../../../packages/ui/src/layout/StorefrontChromeMockup.tsx", import.meta.url),
  "utf8",
);
const navigationSource = readFileSync(new URL("navigation.ts", import.meta.url), "utf8");
const preferenceSync = readFileSync(new URL("layoutPreferencesSync.ts", import.meta.url), "utf8");

test("back-to-top controls are normalized, synchronized, and accessible", () => {
  for (const field of ["showBackToTop", "backToTopStyle", "backToTopIcon", "backToTopPlacement"]) {
    assert.match(navigationSource, new RegExp(field));
  }
  assert.match(preferenceSync, /setShowBackToTop\(layout\.showBackToTop\)/);
  assert.match(preferenceSync, /setBackToTopStyle\(layout\.backToTopStyle\)/);
  assert.match(preferenceSync, /setBackToTopIcon\(layout\.backToTopIcon\)/);
  assert.match(preferenceSync, /setBackToTopPlacement\(layout\.backToTopPlacement\)/);
  assert.match(chromeSource, /aria-label=\{label\}/);
  assert.match(chromeSource, /prefers-reduced-motion: reduce/);
  assert.match(chromeSource, /window\.scrollY >= 480/);
});

test("header arrangement and enforced footer credit flow through the chrome", () => {
  assert.match(preferenceSync, /setHeaderArrangement\(layout\.headerArrangement\)/);
  assert.match(chromeSource, /arrangement=\{headerArrangement\}/);
  assert.match(chromeSource, /themeCredit=\{storefrontConfig\?\.footer\?\.themeCredit \?\? ""\}/);
  assert.match(chromeSource, /showThemeCredit=\{storefrontConfig\?\.footer\?\.showThemeCredit === true\}/);
});
