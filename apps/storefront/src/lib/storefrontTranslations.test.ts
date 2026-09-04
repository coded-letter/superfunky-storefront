import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const localeRoot = new URL("../../../../packages/ui/src/locale/", import.meta.url);
const backendLocaleRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/assets/storefront-ui-strings/",
  import.meta.url,
);
const requiredKeys = [
  "navigation.back_to_top",
  "inquiry.success",
  "inquiry.heading",
  "inquiry.button",
  "inquiry.copy",
  "review.section_heading",
  "review.form_title_product",
  "comment.section_heading",
  "product.details_heading",
  "product.related",
  "archive.taxonomy.category",
  "archive.product_brands_title",
  "archive.no_posts",
];

test("frontend and WordPress catalogs include matching product, review, and archive strings", () => {
  for (const locale of ["en", "pl", "ja"]) {
    const frontend = JSON.parse(readFileSync(new URL(`${locale}.json`, localeRoot), "utf8")) as Record<string, string>;
    const backend = JSON.parse(readFileSync(new URL(`${locale}.json`, backendLocaleRoot), "utf8")) as Record<string, string>;
    assert.deepEqual(Object.keys(frontend).sort(), Object.keys(backend).sort(), `${locale} catalog keys`);
    for (const key of requiredKeys) {
      assert.ok(frontend[key]?.trim(), `${locale}:${key}`);
      assert.equal(backend[key], frontend[key], `${locale}:${key} backend parity`);
    }
  }
});
