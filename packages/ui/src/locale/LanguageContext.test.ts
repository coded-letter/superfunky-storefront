import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LANGUAGE_OPTIONS,
  resolveBootstrapLanguageOptions,
  resolveInitialLanguage,
} from "./options.ts";

const languageOptions = [
  { code: "pl", label: "Polski", flagCode: "PL", backendCode: "PL" },
  { code: "en", label: "English", flagCode: "EN", backendCode: "EN" },
];
const contextSource = readFileSync(new URL("./LanguageContext.tsx", import.meta.url), "utf8");

test("initial language follows the locale rendered into the current document", () => {
  assert.deepEqual(resolveInitialLanguage(null, "pl-PL", languageOptions), {
    languageCode: "pl",
    hasLanguagePreference: false,
  });
});

test("an explicit stored preference wins over the rendered document locale", () => {
  assert.deepEqual(resolveInitialLanguage("en", "pl", languageOptions), {
    languageCode: "en",
    hasLanguagePreference: true,
  });
});

test("a confirmed single-language backend ignores a stale preference during bootstrap", () => {
  const bootstrapOptions = resolveBootstrapLanguageOptions([], "en-US");

  assert.deepEqual(bootstrapOptions.map(({ code }) => code), ["en"]);
  assert.deepEqual(resolveInitialLanguage("pl", "en-US", bootstrapOptions), {
    languageCode: "en",
    hasLanguagePreference: false,
  });
});

test("unknown backend capabilities retain the full built-in language fallback", () => {
  assert.equal(resolveBootstrapLanguageOptions(null, "en"), LANGUAGE_OPTIONS);
  assert.deepEqual(
    resolveBootstrapLanguageOptions([], "pl-PL").map(({ code }) => code),
    ["pl"],
  );
});

test("the provider constrains cached empty backend options before reading a stored preference", () => {
  assert.match(
    contextSource,
    /resolveBootstrapLanguageOptions\(\s*initialBackendOptions,\s*renderedDocumentLanguage,\s*\)/,
  );
  assert.match(
    contextSource,
    /getInitialLanguage\(initialLanguageOptions, initialBackendOptions\?\.length !== 0\)/,
  );
  assert.match(contextSource, /if \(!options\.length\) \{[\s\S]*localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(
    contextSource,
    /const hasLanguagePreference =\s*options\.length > 0[\s\S]*hasLanguagePreference === current\.hasLanguagePreference/,
  );
});

test("rapid language selections compare against the latest requested language", () => {
  assert.match(contextSource, /const currentLanguageCode = useRef\(language\.languageCode\)/);
  assert.match(
    contextSource,
    /if \(currentLanguageCode\.current === normalized\) return;\s+currentLanguageCode\.current = normalized;/,
  );
  assert.doesNotMatch(contextSource, /if \(language\.languageCode === normalized\) return/);
});
