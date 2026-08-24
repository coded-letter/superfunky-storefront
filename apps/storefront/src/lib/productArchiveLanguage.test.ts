import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveArchiveRequestIdentifier,
  resolveProductArchiveRequestIdentifier,
} from "./productArchiveLanguage.ts";

const archivePageSource = readFileSync(
  new URL("../pages/ProductTaxonomyArchivePage.tsx", import.meta.url),
  "utf8",
);
const postArchivePageSource = readFileSync(
  new URL("../pages/PostTaxonomyArchivePage.tsx", import.meta.url),
  "utf8",
);
const commerceSource = readFileSync(new URL("./commerce.ts", import.meta.url), "utf8");

test("language switching requests a translated taxonomy URI with a distinct slug", () => {
  const current = { identifier: "/product-category/sportowe/", idType: "URI" as const };
  const archive = {
    languageCode: "pl",
    translations: [
      { languageCode: "en", uri: "/en/product-category/sport-wear/" },
    ],
  };

  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(current, archive, "en"),
    { identifier: "/en/product-category/sport-wear/", idType: "URI" },
  );
  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(current, archive, "pl"),
    current,
  );
});

test("tag archive switching uses the translated tag slug instead of the source identifier", () => {
  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(
      { identifier: "/product-tag/wyprzedaz/", idType: "URI" },
      {
        languageCode: "pl",
        translations: [{ languageCode: "en", uri: "/en/product-tag/sale/" }],
      },
      "en",
    ),
    { identifier: "/en/product-tag/sale/", idType: "URI" },
  );
});

test("blog taxonomy archive switching reuses the translated URI before the new archive resolves", () => {
  assert.deepEqual(
    resolveArchiveRequestIdentifier(
      { identifier: "aktualnosci", idType: "SLUG" },
      {
        languageCode: "pl",
        translations: [{ languageCode: "en", uri: "/en/category/news/" }],
      },
      "en",
    ),
    { identifier: "/en/category/news/", idType: "URI" },
  );
});

test("taxonomy archive language routing safely retains the current identifier without metadata", () => {
  const current = { identifier: "adidas", idType: "SLUG" as const };
  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(current, null, "en"),
    current,
  );
  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(
      current,
      { languageCode: "pl", translations: [] },
      "en",
    ),
    current,
  );

  const translatedUri = { identifier: "/en/brand/adidas-en/", idType: "URI" as const };
  assert.deepEqual(
    resolveProductArchiveRequestIdentifier(
      translatedUri,
      {
        languageCode: "pl",
        translations: [{ languageCode: "en", uri: "/en/brand/adidas-en/" }],
      },
      "en",
    ),
    translatedUri,
  );
});

test("taxonomy archive queries and pages carry translation routes into loop-safe canonical navigation", () => {
  assert.match(
    commerceSource,
    /translations\s*\{[\s\S]*?databaseId[\s\S]*?uri[\s\S]*?language\s*\{\s*code\s*\}/,
  );
  assert.match(commerceSource, /languageCode:\s*archiveLanguageCode/);
  assert.match(commerceSource, /archive\.translations\?\.flatMap/);
  assert.match(commerceSource, /idType === "URI"[\s\S]*?productSlugFromIdentifier\(identifier\)[\s\S]*?idType: "SLUG"/);
  assert.match(commerceSource, /if \(data\?\.archive\) break/);
  assert.match(archivePageSource, /useCanonicalContentLanguage/);
  assert.match(archivePageSource, /lastResolvedArchive/);
  assert.match(postArchivePageSource, /useCanonicalContentLanguage/);
  assert.match(postArchivePageSource, /lastResolvedArchive/);
});
