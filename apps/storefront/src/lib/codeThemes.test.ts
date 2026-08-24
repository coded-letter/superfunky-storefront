import assert from "node:assert/strict";
import test from "node:test";
import { CODE_THEME_OPTIONS, normalizeCodeTheme } from "./codeThemes.ts";

test("offers all official bundled Prism themes and existing storefront palettes", () => {
  const themes = CODE_THEME_OPTIONS.map(({ value }) => value);
  for (const theme of [
    "auto",
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
    assert.ok(themes.includes(theme), `${theme} should be available`);
  }
});

test("normalizes saved themes without accepting arbitrary CSS selectors", () => {
  assert.equal(normalizeCodeTheme(" Okaidia "), "okaidia");
  assert.equal(normalizeCodeTheme("unknown-theme"), "auto");
  assert.equal(normalizeCodeTheme(null), "auto");
});
