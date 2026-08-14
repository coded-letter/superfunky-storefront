import assert from "node:assert/strict";
import test from "node:test";
import { resolveHomePageDatabaseId } from "./homepageResolution.ts";

const frontPage = {
  databaseId: 52,
  languageCode: "en",
  translations: [{ databaseId: 67, languageCode: "pl" }],
};

test("resolves the configured static front page for its source language", () => {
  assert.equal(resolveHomePageDatabaseId(frontPage, "EN", ["pl", "en"]), 52);
});

test("resolves the translated static front page for the requested language", () => {
  assert.equal(resolveHomePageDatabaseId(frontPage, "pl", ["pl", "en"]), 67);
});

test("does not serve a static front page for an unavailable language", () => {
  assert.equal(resolveHomePageDatabaseId(frontPage, "de", ["pl", "en"]), null);
});
