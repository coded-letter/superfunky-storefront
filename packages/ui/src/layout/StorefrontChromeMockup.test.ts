import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("StorefrontChromeMockup.tsx", import.meta.url), "utf8");

test("initial storefront hydration preserves restored scroll while route changes reset it", () => {
  assert.match(source, /const previousPathname = useRef\(pathname\)/);
  assert.match(source, /if \(previousPathname\.current === pathname\) return;/);
  assert.match(source, /previousPathname\.current = pathname;\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "instant"/);
});
