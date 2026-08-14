import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBackendError, normalizeDisplayLabel } from "./htmlEntities.ts";

test("decodes valid named and numeric HTML entities once", () => {
  assert.equal(normalizeDisplayLabel("Bras &amp; Tanks"), "Bras & Tanks");
  assert.equal(normalizeDisplayLabel("Shirt &#8211; Green"), "Shirt – Green");
  assert.equal(normalizeDisplayLabel("Rock &#x27;n&#x27; Roll"), "Rock 'n' Roll");
  assert.equal(normalizeDisplayLabel("Viktor LumaTech&trade; Pant"), "Viktor LumaTech™ Pant");
  assert.equal(normalizeDisplayLabel("Zażółć &amp; Καλημέρα"), "Zażółć & Καλημέρα");
});

test("normalizes backend validation errors for plain-text display", () => {
  assert.equal(
    normalizeBackendError("<strong>Coupon &quot;HALF&quot;</strong> isn&#039;t valid."),
    "Coupon \"HALF\" isn't valid.",
  );
});

test("preserves literal ampersands, malformed entities, and unknown names", () => {
  assert.equal(normalizeDisplayLabel("Fish & Chips"), "Fish & Chips");
  assert.equal(normalizeDisplayLabel("Broken &amp and &bogus;"), "Broken &amp and &bogus;");
});

test("decodes nested encoding by exactly one layer", () => {
  assert.equal(normalizeDisplayLabel("Research &amp;amp; Development"), "Research &amp; Development");
});
