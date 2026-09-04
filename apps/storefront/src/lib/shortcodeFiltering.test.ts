import assert from "node:assert/strict";
import test from "node:test";
import { matchesPostTaxonomy, matchesShortcodeValues, shortcodeFilterValues } from "./shortcodeFiltering.ts";

test("normalizes comma, pipe, whitespace, case, and legacy underscores", () => {
  assert.deepEqual(shortcodeFilterValues(" News,featured_posts | NEWS "), ["news", "featured-posts"]);
});

test("matches any supplied category or tag and requires different taxonomies together", () => {
  assert.equal(matchesShortcodeValues(["sale", "new"], "missing, SALE"), true);
  assert.equal(matchesPostTaxonomy({
    categories: [{ slug: "Guides" }],
    tags: [{ slug: "featured-posts" }],
    author: { slug: "Ada" },
    authorDatabaseId: 42,
  }, { category: "news,guides", tag: "featured_posts", author: "42" }), true);
});

test("accepts author slugs or database IDs and rejects explicit invalid filters", () => {
  const post = { categories: [], tags: [], author: { slug: "ada-lovelace" }, authorDatabaseId: 42 };
  assert.equal(matchesPostTaxonomy(post, { author: "other,ADA-LOVELACE" }), true);
  assert.equal(matchesPostTaxonomy(post, { author: "7,42" }), true);
  assert.equal(matchesShortcodeValues(["sale"], "!!!"), false);
  assert.equal(matchesShortcodeValues(["sale"], undefined), true);
});

test("preserves localized WordPress slugs", () => {
  assert.equal(matchesShortcodeValues(["日本語"], "日本語"), true);
  assert.equal(matchesShortcodeValues(["zażółć-gęślą"], "ZAŻÓŁĆ_GĘŚLĄ"), true);
});
