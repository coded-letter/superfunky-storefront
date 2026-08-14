import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTaxonomyUri,
  resolveTaxonomyArchiveIdentifier,
  taxonomyEmptyMessage,
  taxonomyNotFoundMessage,
} from "./taxonomyRoutes.ts";

test("uses canonical custom category and tag URIs rather than assumed prefixes", () => {
  assert.deepEqual(resolveTaxonomyArchiveIdentifier("/pro-category/plugins/"), {
    identifier: "/pro-category/plugins/",
    idType: "URI",
  });
  assert.deepEqual(resolveTaxonomyArchiveIdentifier("/pro-tag/summer-sale"), {
    identifier: "/pro-tag/summer-sale/",
    idType: "URI",
  });
});

test("normalizes trailing slashes and percent-encoded taxonomy paths", () => {
  assert.equal(normalizeTaxonomyUri("/pro-category/caf%C3%A9"), "/pro-category/caf%C3%A9/");
  assert.equal(normalizeTaxonomyUri("/pro-category/a%2Fb/"), "/pro-category/a%2Fb/");
  assert.deepEqual(resolveTaxonomyArchiveIdentifier("/shop/category/caf%C3%A9", "caf%C3%A9"), {
    identifier: "café",
    idType: "SLUG",
  });
});

test("preserves nested canonical category paths", () => {
  assert.deepEqual(resolveTaxonomyArchiveIdentifier("/pro-category/software/extensions/"), {
    identifier: "/pro-category/software/extensions/",
    idType: "URI",
  });
});

test("public taxonomy status copy is neutral", () => {
  const copy = [
    taxonomyNotFoundMessage("category"),
    taxonomyNotFoundMessage("tag"),
    taxonomyEmptyMessage("category"),
    taxonomyEmptyMessage("tag"),
  ].join(" ");
  assert.match(copy, /No products found/);
  assert.doesNotMatch(copy, /WordPress|WooCommerce|GraphQL|\bCMS\b|\bWP\b/i);
});
