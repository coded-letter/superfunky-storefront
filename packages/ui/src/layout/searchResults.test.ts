import assert from "node:assert/strict";
import test from "node:test";
import {
  groupSearchResults,
  searchResultGroup,
  type SearchResultItem,
} from "./searchResults.ts";

const item = (type: SearchResultItem["type"], id: string): SearchResultItem => ({
  type,
  id,
  title: id,
  subtitle: type,
  href: `/${id}`,
});

test("groups search types into accessible result families", () => {
  assert.equal(searchResultGroup("product_brand"), "catalog");
  assert.equal(searchResultGroup("author"), "editorial");
  assert.equal(searchResultGroup("community_author"), "community");
  assert.equal(searchResultGroup("page"), "pages");
});

test("caps each group and type without letting products crowd out other families", () => {
  const grouped = groupSearchResults([
    item("product", "product-1"),
    item("product", "product-2"),
    item("product", "product-3"),
    item("product_brand", "brand"),
    item("post", "post"),
    item("author", "author"),
    item("community_post", "community-post"),
    item("community_author", "community-author"),
    item("page", "page"),
  ]);

  assert.deepEqual(grouped.map(({ group }) => group), ["catalog", "editorial", "community", "pages"]);
  assert.deepEqual(grouped[0]?.items.map(({ id }) => id), ["product-1", "product-2", "brand"]);
  assert.equal(grouped.flatMap(({ items }) => items).some(({ id }) => id === "product-3"), false);
});
