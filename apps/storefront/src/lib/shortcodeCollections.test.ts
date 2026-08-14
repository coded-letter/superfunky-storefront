import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCollectionOffset,
  withCollectionOffset,
} from "./shortcodeCollections.ts";

test("applies shortcode offsets before collection limits", () => {
  const items = ["first", "second", "third", "fourth", "fifth"];

  assert.deepEqual(withCollectionOffset(items, "2", 2), ["third", "fourth"]);
  assert.deepEqual(withCollectionOffset(items, "3"), ["fourth", "fifth"]);
  assert.deepEqual(items, ["first", "second", "third", "fourth", "fifth"]);
});

test("bounds invalid shortcode offsets", () => {
  assert.equal(parseCollectionOffset(undefined), 0);
  assert.equal(parseCollectionOffset("invalid"), 0);
  assert.equal(parseCollectionOffset("-3"), 0);
  assert.equal(parseCollectionOffset("2000000"), 1_000_000);
});
