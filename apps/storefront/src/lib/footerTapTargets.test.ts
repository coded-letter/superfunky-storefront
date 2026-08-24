import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const staticShell = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const footer = readFileSync(
  new URL("../../../../packages/ui/src/layout/FooterMockup.tsx", import.meta.url),
  "utf8",
);

test("static and hydrated footer links retain mobile-friendly tap targets", () => {
  const staticRule = staticShell.match(/\.storefront-static-footer-column a \{[\s\S]*?\n\s*\}/)?.[0] || "";
  assert.match(staticRule, /display: flex/);
  assert.match(staticRule, /min-height: 48px/);
  assert.match(staticRule, /touch-action: manipulation/);
  assert.match(footer, /inline-flex min-h-12 items-center py-2/);
  assert.match(footer, /inline-grid h-12 w-12/);
});
