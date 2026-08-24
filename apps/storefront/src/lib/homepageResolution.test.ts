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

test("does not override reliable homepage language metadata with the configured default", () => {
  assert.equal(resolveHomePageDatabaseId(frontPage, "pl", ["pl", "en"], "pl"), 67);
  assert.equal(resolveHomePageDatabaseId(frontPage, "en", ["pl", "en"], "pl"), 52);
});

test("trusts the backend default for page_on_front when page language metadata is unavailable", () => {
  const degradedFrontPage = {
    databaseId: 5,
    languageCode: "en",
    translations: [{ databaseId: 368, languageCode: "en" }],
  };

  assert.equal(resolveHomePageDatabaseId(degradedFrontPage, "pl", ["pl", "en"], "pl"), 5);
  assert.equal(resolveHomePageDatabaseId(degradedFrontPage, "en", ["pl", "en"], "pl"), 368);
});

test("does not serve a static front page for an unavailable language", () => {
  assert.equal(resolveHomePageDatabaseId(frontPage, "de", ["pl", "en"]), null);
});
