import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.ts";

test("slugify: lowercases and hyphenates spaces", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("slugify: strips diacritics", () => {
  assert.equal(slugify("Café Déjà Vu"), "cafe-deja-vu");
});

test("slugify: collapses runs of punctuation into a single hyphen", () => {
  assert.equal(slugify("A -- B ,, C!!"), "a-b-c");
});

test("slugify: trims leading/trailing hyphens", () => {
  assert.equal(slugify("  --Leading and trailing--  "), "leading-and-trailing");
});

test("slugify: truncates to 200 characters", () => {
  const long = "a".repeat(250);
  assert.equal(slugify(long).length, 200);
});

test("slugify: returns empty string for input with no slug-able characters", () => {
  assert.equal(slugify("!!!"), "");
});
