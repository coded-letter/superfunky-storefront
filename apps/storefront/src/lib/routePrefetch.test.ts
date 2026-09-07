import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./routePrefetch.ts", import.meta.url), "utf8");

test("commerce taxonomy prefetch bypasses generic and protected page lookup", () => {
  assert.match(source, /\["product-category", "pro-cat"\]/);
  assert.match(source, /\["product-tag", "pro-tag"\]/);
  assert.match(source, /const taxonomy = commerceTaxonomyForPath\(pathname, languageCodes\)/);
  assert.match(source, /if \(taxonomy\) \{[\s\S]*getProductArchive\([\s\S]*return;/);
  assert.ok(
    source.indexOf("if (taxonomy)") < source.indexOf("getPageByUri(uri)"),
    "taxonomy routing must return before generic page prefetch",
  );
});
