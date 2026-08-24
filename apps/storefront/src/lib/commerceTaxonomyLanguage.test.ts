import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  mapLocalizedCatalogTerms,
  mapLocalizedTerms,
  type RawLocalizedTerm,
} from "./commerceTaxonomyLanguage.ts";
import {
  isMissingProductOptionalFieldSchemaError,
  requestCommerceWithFallback,
  requestCommerceWithFallbackChain,
  type CommerceGraphqlRequester,
} from "./commerceGraphqlCompatibility.ts";

const commerceSource = readFileSync(new URL("./commerce.ts", import.meta.url), "utf8");
const archivePageSource = readFileSync(
  new URL("../pages/ProductTaxonomyArchivePage.tsx", import.meta.url),
  "utf8",
);
const shortcodesSource = readFileSync(
  new URL("../components/wordpressShortcodes.tsx", import.meta.url),
  "utf8",
);

function term(
  databaseId: number,
  name: string,
  language?: string,
  translationDatabaseId?: number,
): RawLocalizedTerm {
  return {
    id: `term-${databaseId}`,
    databaseId,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    uri: `/product-category/${name.toLowerCase().replaceAll(" ", "-")}/`,
    language: language ? { code: language } : undefined,
    translations: translationDatabaseId
      ? [{
          id: `term-${translationDatabaseId}`,
          databaseId: translationDatabaseId,
          language: { code: language === "EN" ? "PL" : "EN" },
        }]
      : undefined,
  };
}

function productsWithCategories(...categories: RawLocalizedTerm[]) {
  return [{ productCategories: { nodes: categories } }];
}

function mapCatalogCategories(
  categories: RawLocalizedTerm[],
  listing: RawLocalizedTerm[],
  language: string,
) {
  return mapLocalizedCatalogTerms(
    productsWithCategories(...categories),
    listing,
    language,
    (product) => product.productCategories.nodes,
  );
}

test("catalog terms select and deduplicate the requested category translation", () => {
  const english = term(38, "Sport wear", "EN", 15);
  const polish = term(15, "Sportowe", "PL", 38);

  assert.deepEqual(
    mapCatalogCategories(
      [english, polish],
      [english, polish],
      "en",
    ).map(({ databaseId, name }) => ({ databaseId, name })),
    [{ databaseId: 38, name: "Sport wear" }],
  );
  assert.deepEqual(
    mapCatalogCategories(
      [english, polish],
      [english, polish],
      "pl",
    ).map(({ databaseId, name }) => ({ databaseId, name })),
    [{ databaseId: 15, name: "Sportowe" }],
  );
});

test("catalog term mapping preserves assigned terms when language metadata is unavailable", () => {
  const sportWear = term(38, "Sport wear");
  const sportowe = term(15, "Sportowe");

  assert.deepEqual(
    mapCatalogCategories(
      [sportWear, sportowe],
      [sportWear, sportowe],
      "en",
    ).map(({ databaseId }) => databaseId),
    [38, 15],
  );
});

test("localized term mapping excludes language-less terms when exact metadata is available", () => {
  const english = term(38, "Sport wear", "EN", 15);
  const languageLess = term(15, "Sportowe");

  assert.deepEqual(
    mapCatalogCategories(
      [languageLess, english],
      [english],
      "en",
    ).map(({ databaseId, name }) => ({ databaseId, name })),
    [{ databaseId: 38, name: "Sport wear" }],
  );
});

test("product tag collections map only the selected translation with metadata fallback", () => {
  const english = term(48, "Summer", "EN", 49);
  const polish = term(49, "Lato", "PL", 48);
  assert.deepEqual(
    mapLocalizedTerms([polish, english], "en").map(({ databaseId, name }) => ({ databaseId, name })),
    [{ databaseId: 48, name: "Summer" }],
  );

  const languageLess = term(50, "Sale");
  assert.deepEqual(
    mapLocalizedTerms([languageLess], "en").map(({ databaseId }) => databaseId),
    [50],
  );
});

test("localized commerce queries scope categories and brands with core-schema fallbacks", () => {
  assert.match(commerceSource, /productCategories\([^)]*language:\s*\$language/);
  assert.match(commerceSource, /productBrands\([^)]*language:\s*\$language/);
  assert.match(
    commerceSource,
    /const LOCALIZED_TERM_FIELDS[\s\S]*?translations\s*\{[\s\S]*?databaseId[\s\S]*?uri[\s\S]*?language\s*\{\s*code\s*\}/,
  );
  assert.match(
    commerceSource,
    /PRODUCT_BRAND_DIRECTORY_QUERY[\s\S]*?LanguageCodeFilterEnum[\s\S]*?productBrands\([^)]*language:\s*\$language/,
  );
  assert.match(
    commerceSource,
    /function archiveQuery[\s\S]*?\$\{LOCALIZED_TERM_FIELDS\}[\s\S]*?\n}/,
  );
  assert.match(
    commerceSource,
    /localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:\s*\{\s*\$\{productFilter\}:\s*\$taxonomySlug,\s*language:\s*\$language\s*\}\)/,
  );
  assert.match(
    commerceSource,
    /siblings:\s*\$\{plural\}\(first:\s*50,\s*where:\s*\{\s*hideEmpty:\s*true,\s*language:\s*\$language\s*\}\)/,
  );
  assert.match(
    commerceSource,
    /COMPATIBLE_PRODUCT_BRAND_DIRECTORY_QUERY[\s\S]*?\$\{TERM_FIELDS\}/,
  );
});

test("an older brand schema falls back independently without unscoping products or categories", async () => {
  const catalogQuery = commerceSource.match(
    /export const CATALOG_QUERY = [\s\S]*?`([\s\S]*?)`;/,
  )?.[1] || "";
  assert.doesNotMatch(catalogQuery, /productBrands\(first:\s*50/);
  assert.match(
    commerceSource,
    /Promise\.all\(\[[\s\S]*?requestCatalogWithFallback<CatalogResult>[\s\S]*?requestCommerceWithFallback<CatalogBrandsResult>/,
  );

  const queries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    queries.push(query);
    if (query === "localized brands") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "language" on type "ProductBrand".' }],
      };
    }
    return { data: { productBrands: { nodes: ["Adidas"] } } as T };
  };
  const result = await requestCommerceWithFallback<{ productBrands: { nodes: string[] } }>(
    request,
    "localized brands",
    "core brands",
    { language: "EN" },
    isMissingProductOptionalFieldSchemaError,
  );

  assert.deepEqual(result, { productBrands: { nodes: ["Adidas"] } });
  assert.deepEqual(queries, ["localized brands", "core brands"]);
});

test("product tags query by language and fall back independently on older schemas", async () => {
  assert.match(
    commerceSource,
    /CATALOG_TAGS_QUERY[\s\S]*?productTags\([^)]*language:\s*\$language[\s\S]*?\$\{LOCALIZED_TERM_FIELDS\}/,
  );
  assert.match(
    commerceSource,
    /COMPATIBLE_CATALOG_TAGS_QUERY[\s\S]*?productTags\([^)]*hideEmpty:\s*true[\s\S]*?\$\{TERM_FIELDS\}/,
  );
  assert.match(commerceSource, /tags:\s*mapTerms\(tagData\?\.productTags\?\.nodes,\s*languageCodeUsed\)/);

  const queries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    queries.push(query);
    if (query === "localized tags") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "language" on type "ProductTag".' }],
      };
    }
    return { data: { productTags: { nodes: ["Summer"] } } as T };
  };
  const result = await requestCommerceWithFallback<{ productTags: { nodes: string[] } }>(
    request,
    "localized tags",
    "core tags",
    { language: "EN" },
    isMissingProductOptionalFieldSchemaError,
  );
  assert.deepEqual(result, { productTags: { nodes: ["Summer"] } });
  assert.deepEqual(queries, ["localized tags", "core tags"]);
});

test("archive and product-tag pills canonicalize every translated taxonomy URI", () => {
  assert.match(
    archivePageSource,
    /to=\{normalizeLanguagePath\(term\.uri,\s*languageCode,\s*configuredLanguageCodes\)\}/,
  );
  assert.match(
    shortcodesSource,
    /ProductTagsShortcode[\s\S]*normalizeLanguagePath\(tag\.uri,\s*languageCode,\s*configuredLanguageCodes\)/,
  );
});

test("brand archive term fallback preserves language-scoped products before core fallback", async () => {
  const queries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    queries.push(query);
    if (query === "localized terms") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "language" on type "ProductBrand".' }],
      };
    }
    return { data: { archive: { products: ["English product"] } } as T };
  };

  const result = await requestCommerceWithFallbackChain<{ archive: { products: string[] } }>(
    request,
    ["localized terms", "localized products", "core"],
    { language: "EN" },
    isMissingProductOptionalFieldSchemaError,
  );

  assert.deepEqual(result, { archive: { products: ["English product"] } });
  assert.deepEqual(queries, ["localized terms", "localized products"]);
  assert.match(
    commerceSource,
    /compatibleLocalizedBrandArchiveQuery[\s\S]*?localizedProducts:\s*products\(first:\s*\$first,\s*after:\s*\$after,\s*where:\s*\{\s*productBrand:\s*\$brandSlug,\s*language:\s*\$language\s*\}\)/,
  );
});

test("translated product taxonomy routes include localized brand archives", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const directorySource = readFileSync(new URL("../pages/ProductBrandDirectoryPage.tsx", import.meta.url), "utf8");
  const archiveSource = readFileSync(new URL("../pages/ProductTaxonomyArchivePage.tsx", import.meta.url), "utf8");

  assert.match(appSource, /path="\/:language\/brand\/:slug"/);
  assert.match(directorySource, /normalizeLanguagePath\("\/product-brand", languageCode, configuredLanguageCodes\)/);
  assert.match(directorySource, /normalizeLanguagePath\(brand\.uri, languageCode, configuredLanguageCodes\)/);
  assert.match(archiveSource, /href: brandDirectoryPath/);
  assert.match(archiveSource, /normalizeLanguagePath\(term\.uri, languageCode, configuredLanguageCodes\)/);
});
