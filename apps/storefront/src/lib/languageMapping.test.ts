import assert from "node:assert/strict";
import test from "node:test";
import { languageHomePath, mapBackendLanguages } from "./languageMapping.ts";

test("maps backend EN and JA records without deriving enum values from slugs", () => {
  assert.deepEqual(
    mapBackendLanguages([
      { code: "EN", name: "English", slug: "en" },
      { code: "JA", name: "日本語", slug: "ja" },
    ]),
    [
      { code: "en", label: "English", backendCode: "EN" },
      { code: "ja", label: "日本語", backendCode: "JA" },
    ],
  );
  assert.equal(languageHomePath("JA"), "/ja");
});

test("preserves PL when the backend genuinely advertises it", () => {
  assert.deepEqual(
    mapBackendLanguages([
      { code: "EN", name: "English", slug: "en" },
      { code: "PL", name: "Polski", slug: "pl" },
    ])[1],
    { code: "pl", label: "Polski", backendCode: "PL" },
  );
});
