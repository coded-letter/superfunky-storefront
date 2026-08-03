import test from "node:test";
import assert from "node:assert/strict";
import { filterTranslationCandidates, type RawTranslationCandidateNode } from "./translationCandidates.ts";

const nodes: RawTranslationCandidateNode[] = [
  { databaseId: 1, title: "Bonjour le monde", uri: "/fr/bonjour/", language: { code: "fr" } },
  { databaseId: 2, title: "Hello World", uri: "/en/hello/", language: { code: "en" } },
  { databaseId: 3, title: null, uri: null, language: { code: "FR" } },
  { databaseId: 4, title: "No language", uri: "/no-lang/", language: null },
  { databaseId: 5, title: "Also English", uri: "/en/also/", language: { code: "en" } },
];

test("filterTranslationCandidates: excludes results in the same language as the post being edited", () => {
  const result = filterTranslationCandidates(nodes, "en");
  assert.deepEqual(
    result.map((r) => r.databaseId),
    [1, 3],
  );
});

test("filterTranslationCandidates: same-language exclusion is case-insensitive", () => {
  const result = filterTranslationCandidates(nodes, "EN");
  assert.deepEqual(
    result.map((r) => r.databaseId),
    [1, 3],
  );
});

test("filterTranslationCandidates: excludes the post itself (no self-association)", () => {
  const result = filterTranslationCandidates(nodes, "en", 1);
  assert.deepEqual(
    result.map((r) => r.databaseId),
    [3],
  );
});

test("filterTranslationCandidates: excludes results with no known language", () => {
  const result = filterTranslationCandidates(nodes, "de");
  assert.ok(!result.some((r) => r.databaseId === 4));
});

test("filterTranslationCandidates: falls back to a placeholder title when missing", () => {
  const result = filterTranslationCandidates(nodes, "en");
  const untitled = result.find((r) => r.databaseId === 3);
  assert.equal(untitled?.title, "Post #3");
});

test("filterTranslationCandidates: normalizes language codes to lowercase in the output", () => {
  const result = filterTranslationCandidates(nodes, "en");
  const frenchCandidate = result.find((r) => r.databaseId === 3);
  assert.equal(frenchCandidate?.languageCode, "fr");
});
