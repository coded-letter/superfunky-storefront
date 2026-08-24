import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveUiString } from "./uiStrings.ts";

const readLocale = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`./${locale}.json`, import.meta.url), "utf8")) as Record<string, string>;

test("UI strings prefer backend overrides and interpolate named values", () => {
  assert.equal(
    resolveUiString("order", { order: "Zamówienie {number}" }, { order: "Order {number}" }, { order: "Custom {number}" }, { number: 42 }),
    "Custom 42",
  );
});

test("UI strings fall back through English and finally the stable key", () => {
  assert.equal(resolveUiString("checkout", {}, { checkout: "Checkout" }), "Checkout");
  assert.equal(resolveUiString("missing.key", {}, {}), "missing.key");
});

test("versioned storefront locales cover every English key and placeholder", () => {
  const english = readLocale("en");
  const englishKeys = Object.keys(english).sort();

  for (const locale of ["pl", "ja"]) {
    const translated = readLocale(locale);
    assert.deepEqual(Object.keys(translated).sort(), englishKeys, `${locale} keys must match English`);
    for (const key of englishKeys) {
      const placeholders = (english[key]?.match(/\{[^}]+\}/g) || []).sort();
      assert.deepEqual(
        (translated[key]?.match(/\{[^}]+\}/g) || []).sort(),
        placeholders,
        `${locale}.${key} must preserve placeholders`,
      );
    }
  }
});

test("versioned locale values round-trip through the Control Center without escaped quotes", () => {
  for (const strings of ["en", "pl", "ja"].map(readLocale)) {
    assert.equal(Object.values(strings).some((value) => value.includes('"')), false);
  }
});

test("dynamic UI-string key maps stay inside the versioned contract", () => {
  const english = readLocale("en");
  const sources = [
    readFileSync(new URL("../layout/CookieConsentBanner.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../../../../apps/storefront/src/pages/AccountMockupPage.tsx", import.meta.url), "utf8"),
  ];
  const dynamicKeys = sources.flatMap((source) =>
    Array.from(source.matchAll(/"(cookie\.(?:category|manager)\.[a-z0-9_.-]+|account\.guest\.[a-z0-9_.-]+)"/g), (match) => match[1]),
  );

  assert.ok(dynamicKeys.length > 0);
  for (const key of dynamicKeys) {
    assert.equal(typeof english[key], "string", `${key} must exist in the English UI-string contract`);
  }
});
