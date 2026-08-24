import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveInitialLanguage } from "./options.ts";

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

test("rapid language selections compare against the latest requested language", () => {
  assert.match(contextSource, /const currentLanguageCode = useRef\(language\.languageCode\)/);
  assert.match(
    contextSource,
    /if \(currentLanguageCode\.current === normalized\) return;\s+currentLanguageCode\.current = normalized;/,
  );
  assert.doesNotMatch(contextSource, /if \(language\.languageCode === normalized\) return/);
});
