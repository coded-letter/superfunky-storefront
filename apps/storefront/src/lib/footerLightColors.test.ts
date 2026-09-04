import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("light-mode footer links use a high-contrast default across every footer variant", () => {
  assert.match(
    styles,
    /html:not\(\.dark\) \.funky-footer a\s*\{\s*color: #d4d4d8;/,
  );
});

test("light-mode footer link interaction states use the configured brand accent", () => {
  for (const state of [":hover", ":active", '[aria-current="page"]', ":focus-visible"]) {
    assert.match(styles, new RegExp(`html:not\\(\\.dark\\) \\.funky-footer a${state.replace(/[[\]]/g, "\\$&")}`));
  }
  assert.match(styles, /color: rgb\(var\(--brand-300\)\)/);
  assert.match(styles, /outline: 2px solid rgb\(var\(--brand-300\)\)/);
  assert.match(styles, /outline-offset: 3px/);
});

test("footer link overrides are light-mode scoped so dark mode remains unchanged", () => {
  const footerLinkRules = styles.match(/[^{}]*\.funky-footer a[^{}]*\{[^{}]*\}/g) ?? [];
  assert.ok(footerLinkRules.length >= 3);
  assert.ok(footerLinkRules.every((rule) => rule.includes("html:not(.dark)")));
});
