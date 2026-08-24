import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertNoCommerceGraphqlErrors,
  createCompatibleProductDetailQuery,
  createCoreProductDetailQuery,
  createProductQueryWithoutBrands,
  isMissingProductBrandSchemaError,
  isMissingProductOptionalFieldSchemaError,
  isMissingProductRootSchemaError,
  requestCommerceWithFallback,
  requestCatalogWithFallback,
  requestCompatibleCatalog,
  requestOptionalCommerceRoot,
  type CommerceGraphqlRequester,
} from "./commerceGraphqlCompatibility.ts";
import {
  FEATURED_PRODUCT_QUERY,
  PRODUCT_LIST_CARD_FIELDS,
  mapProductCard,
  type RawProductCard,
} from "./commerce.ts";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("catalog product cards request gallery images for the gallery variant", () => {
  assert.match(PRODUCT_LIST_CARD_FIELDS, /\bgalleryImages\s*\(\s*first:\s*12\s*\)/);
  assert.match(PRODUCT_LIST_CARD_FIELDS, /\bgalleryImages[\s\S]*\bsourceUrl\b/);
});

test("featured WooCommerce products are preserved for the empty-cart promotion", () => {
  const product: RawProductCard = {
    __typename: "SimpleProduct",
    id: "featured-product",
    databaseId: 4970,
    slug: "featured-product",
    uri: "/product/featured-product/",
    name: "Featured product",
    shortDescription: null,
    engagementRating: {
      average: null,
      count: 0,
      guestCount: 0,
      authoredCount: 0,
      histogram: [0, 0, 0, 0, 0],
    },
    featured: true,
    onSale: false,
    image: null,
    galleryImages: null,
    productCategories: null,
    productTags: null,
    productBrands: null,
    price: "€10.00",
    regularPrice: "€10.00",
    salePrice: null,
    stockStatus: "IN_STOCK",
    stockQuantity: 1,
  };

  assert.equal(mapProductCard(product).featured, true);
  assert.match(FEATURED_PRODUCT_QUERY, /products\(first: 1, where: \{ featured: true, language: \$language \}\)/);
  assert.match(appSource, /getFeaturedProduct\(languageBackendCode\)/);
  assert.match(appSource, /featuredProduct=\{isBackendConfigured \? featuredProduct \?\? undefined : MOCK_PRODUCTS\[0\]\}/);
});

test("product detail fallback removes optional fields without losing core commerce data", () => {
  const query = `
    product {
      name
      galleryImages { nodes { sourceUrl } }
      headlessDescription
      headlessShortDescription
      currencyPrices
      priceBehavior
      language { code }
      translations {
        databaseId
        uri
        language { code }
      }
      seo { title }
      ... on SimpleProduct {
        price
        stockStatus
      }
      ... on ExternalProduct {
        buttonText
        externalUrl
      }
    }`;
  const compatibleQuery = createCompatibleProductDetailQuery(query, "title");

  for (const field of [
    "headlessDescription",
    "headlessShortDescription",
    "currencyPrices",
    "priceBehavior",
    "translations",
    "buttonText",
  ]) {
    assert.doesNotMatch(compatibleQuery, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(compatibleQuery, /\blanguage\s*\{/);
  assert.doesNotMatch(compatibleQuery, /\bseo\s*\{/);
  assert.match(compatibleQuery, /\bgalleryImages\b/);
  assert.match(compatibleQuery, /\bprice\b/);
  assert.match(compatibleQuery, /\bstockStatus\b/);
  assert.match(compatibleQuery, /\bexternalUrl\b/);
});

test("core product detail removes only schema extensions and preserves theme commerce fields", () => {
  const query = `
    product {
      name
      headlessDescription
      headlessShortDescription
      currencyPrices
      priceBehavior
      language { code }
      translations { uri language { code } }
      seo { title }
      ... on ExternalProduct { buttonText externalUrl }
    }`;
  const coreQuery = createCoreProductDetailQuery(query);

  assert.doesNotMatch(coreQuery, /\blanguage\s*\{|\btranslations\s*\{|\bseo\s*\{/);
  assert.match(coreQuery, /\bheadlessDescription\b|\bheadlessShortDescription\b/);
  assert.match(coreQuery, /\bcurrencyPrices\b|\bpriceBehavior\b|\bbuttonText\b|\bexternalUrl\b/);
});

test("no-brand compatibility removes only nested product brand selections", () => {
  const query = `
    query Catalog {
      products {
        nodes {
          name
          productBrands { nodes { name uri } }
          productCategories { nodes { name uri } }
        }
      }
    }`;
  const compatible = createProductQueryWithoutBrands(query);

  assert.doesNotMatch(compatible, /\bproductBrands\b/);
  assert.match(compatible, /\bproducts\b/);
  assert.match(compatible, /\bproductCategories\b/);
});

test("product root compatibility errors require the RootQuery context", () => {
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Cannot query field "products" on type "RootQuery".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Unknown type "LanguageCodeFilterEnum".' },
      { message: 'Cannot query field "products" on type "RootQuery".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Unknown type "SimpleProduct".' },
      { message: 'Unknown type "ProductCategoryIdType".' },
      { message: 'Value "PRODUCT" does not exist in "ContentTypeEnum" enum.' },
      { message: 'Cannot query field "products" on type "RootQuery".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Unknown type "SimpleProduct".' },
    ]),
    false,
  );
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Cannot query field "products" on type "ProductCategory".' },
    ]),
    false,
  );
  assert.equal(
    isMissingProductRootSchemaError([
      { message: 'Cannot query field "productBrands" on type "Product".' },
    ]),
    false,
  );
});

test("missing brand archives recognize the complete validation family without hiding runtime errors", async () => {
  const missingBrandErrors = [
    { message: 'Cannot query field "productBrand" on type "RootQuery".' },
    { message: 'Unknown type "ProductBrandIdType".' },
    { message: 'Field "productBrand" is not defined by type "RootQueryToProductConnectionWhereArgs".' },
    { message: 'Field "productBrand" is not defined by type "RootQueryToProductUnionConnectionWhereArgs".' },
    { message: 'Field "language" is not defined by type "RootQueryToProductBrandConnectionWhereArgs".' },
    { message: 'Cannot query field "productBrands" on type "Product".' },
  ];
  assert.equal(isMissingProductBrandSchemaError(missingBrandErrors), true);
  assert.equal(isMissingProductRootSchemaError(missingBrandErrors), true);
  assert.equal(
    isMissingProductBrandSchemaError([
      ...missingBrandErrors,
      { message: "Product brand resolver timed out." },
    ]),
    false,
  );

  const queries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    queries.push(query);
    return { data: null, errors: missingBrandErrors };
  };
  assert.equal(
    await requestCommerceWithFallback(request, "brand archive", "compatible archive", {}, () => false),
    null,
  );
  assert.deepEqual(queries, ["brand archive"]);
});

test("product optional-field compatibility errors remain narrowly scoped", () => {
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      { message: 'Unknown type "LanguageCodeFilterEnum".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      { message: 'Field "language" is not defined by type "RootQueryToProductUnionConnectionWhereArgs".' },
      { message: 'Cannot query field "translations" on type "Product".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      {
        message: "The field &#039;language&#039; on Type &#039;Product&#039; is configured to return &#039;ContentLanguage&#039; which is a non-existent Type in the Schema.",
      },
    ]),
    true,
  );
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      { message: 'Cannot query field "products" on type "RootQuery".' },
    ]),
    false,
  );
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      { message: 'Cannot query field "productBrands" on type "Product".' },
    ]),
    true,
  );
  assert.equal(
    isMissingProductOptionalFieldSchemaError([
      { message: "The backend timed out while resolving products." },
    ]),
    false,
  );
});

test("compatible catalog isolates unavailable root connections without discarding valid sections", async () => {
  type Catalog = {
    products: { nodes: string[] } | null;
    productCategories: { nodes: string[] } | null;
    productTags: { nodes: string[] } | null;
  };
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    if (query === "categories") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "productCategories" on type "RootQuery".' }],
      };
    }
    const field = query as keyof Catalog;
    return { data: { [field]: { nodes: [query] } } as T };
  };

  const catalog = await requestCompatibleCatalog<Catalog>(request, [
    { field: "products", query: "products" },
    { field: "productCategories", query: "categories" },
    { field: "productTags", query: "productTags" },
  ]);

  assert.deepEqual(catalog.products, { nodes: ["products"] });
  assert.equal(catalog.productCategories, null);
  assert.deepEqual(catalog.productTags, { nodes: ["productTags"] });
});

test("compatible catalog treats the Woo-only product review enum as absent on blog schemas", async () => {
  type Catalog = {
    products: { nodes: string[] } | null;
    reviews: { nodes: string[] } | null;
  };
  const request: CommerceGraphqlRequester = async <T>(query: string) => query === "reviews"
    ? {
        data: null,
        errors: [
          { message: 'Value "PRODUCT" does not exist in "ContentTypeEnum" enum.' },
          { message: 'Unknown type "Product".' },
        ],
      }
    : { data: { products: null } as T };

  const catalog = await requestCompatibleCatalog<Catalog>(request, [
    { field: "products", query: "products" },
    { field: "reviews", query: "reviews" },
  ]);

  assert.equal(catalog.products, null);
  assert.equal(catalog.reviews, null);
});

test("Woo-only catalog retries the exact no-Polylang validation batch", async () => {
  type Catalog = {
    products: { nodes: string[] } | null;
    productCategories: { nodes: string[] } | null;
  };
  const requestedQueries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query === "primary") {
      return {
        data: null,
        errors: [
          { message: 'Unknown type "LanguageCodeFilterEnum".' },
          { message: 'Field "language" is not defined by type "RootQueryToProductConnectionWhereArgs".' },
        ],
      };
    }
    const field = query as keyof Catalog;
    return { data: { [field]: { nodes: [query] } } as T };
  };

  const result = await requestCatalogWithFallback<Catalog>(
    request,
    "primary",
    { language: "EN" },
    [
      { field: "products", query: "products" },
      { field: "productCategories", query: "productCategories" },
    ],
    isMissingProductOptionalFieldSchemaError,
  );

  assert.equal(result.usesCompatibilityFallback, true);
  assert.deepEqual(result.data.products, { nodes: ["products"] });
  assert.deepEqual(result.data.productCategories, { nodes: ["productCategories"] });
  assert.deepEqual(requestedQueries, ["primary", "products", "productCategories"]);
});

test("missing product brands retry a scoped catalog query without unscoping products", async () => {
  type Catalog = {
    products: { nodes: string[] } | null;
  };
  const requestedQueries: string[] = [];
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query === "localized with brands") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "productBrands" on type "Product".' }],
      };
    }
    if (query === "localized without brands") {
      return { data: { products: { nodes: ["English product"] } } as T };
    }
    throw new Error("The unscoped compatibility operation must not run");
  };

  const result = await requestCatalogWithFallback<Catalog>(
    request,
    "localized with brands",
    { language: "EN" },
    [{ field: "products", query: "unscoped products" }],
    isMissingProductOptionalFieldSchemaError,
    false,
    "localized without brands",
  );

  assert.equal(result.usesCompatibilityFallback, false);
  assert.deepEqual(result.data.products, { nodes: ["English product"] });
  assert.deepEqual(requestedQueries, ["localized with brands", "localized without brands"]);
});

test("free-profile commerce starts with compatible operations and never sends invalid rich queries", async () => {
  type Catalog = {
    products: { nodes: string[] } | null;
    productCategories: { nodes: string[] } | null;
  };
  const catalogQueries: string[] = [];
  const catalogRequest: CommerceGraphqlRequester = async <T>(query: string) => {
    catalogQueries.push(query);
    const field = query as keyof Catalog;
    return { data: { [field]: { nodes: [query] } } as T };
  };
  const catalog = await requestCatalogWithFallback<Catalog>(
    catalogRequest,
    "rich",
    { language: "EN" },
    [
      { field: "products", query: "products" },
      { field: "productCategories", query: "productCategories" },
    ],
    isMissingProductOptionalFieldSchemaError,
    true,
  );
  assert.equal(catalog.usesCompatibilityFallback, true);
  assert.deepEqual(new Set(catalogQueries), new Set(["products", "productCategories"]));
  assert.equal(catalogQueries.includes("rich"), false);

  const detailQueries: string[] = [];
  const detailRequest: CommerceGraphqlRequester = async <T>(query: string) => {
    detailQueries.push(query);
    return { data: { product: { id: "product-1" } } as T };
  };
  const detail = await requestCommerceWithFallback<{ product: { id: string } }>(
    detailRequest,
    "rich",
    "compatible",
    { slug: "hat" },
    isMissingProductOptionalFieldSchemaError,
    true,
  );
  assert.deepEqual(detail, { product: { id: "product-1" } });
  assert.deepEqual(detailQueries, ["compatible"]);
});

test("independent compatible catalog operations run concurrently", async () => {
  let active = 0;
  let maxActive = 0;
  const request: CommerceGraphqlRequester = async <T>(query: string) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    active -= 1;
    return { data: { [query]: { nodes: [] } } as T };
  };

  await requestCompatibleCatalog(request, [
    { field: "products", query: "products" },
    { field: "productCategories", query: "productCategories" },
    { field: "productTags", query: "productTags" },
  ]);

  assert.equal(maxActive, 3);
});

test("catalog compatibility rejects unrelated errors even when partial data exists", async () => {
  const request: CommerceGraphqlRequester = async <T>() => ({
    data: { products: { nodes: [] } } as T,
    errors: [{ message: "Database connection failed" }],
  });

  await assert.rejects(
    requestCompatibleCatalog(request, [{ field: "products", query: "products" }]),
    /Database connection failed/,
  );
});

test("detail and archive compatibility retry once and reject errors from the fallback", async () => {
  const queries: string[] = [];
  const successfulRequest: CommerceGraphqlRequester = async <T>(query: string) => {
    queries.push(query);
    if (query === "primary") {
      return {
        data: null,
        errors: [{ message: 'Cannot query field "seo" on type "Product".' }],
      };
    }
    return { data: { product: { id: "product-1" } } as T };
  };

  const data = await requestCommerceWithFallback<{ product: { id: string } }>(
    successfulRequest,
    "primary",
    "compatible",
    { slug: "example" },
    isMissingProductOptionalFieldSchemaError,
  );
  assert.deepEqual(data, { product: { id: "product-1" } });
  assert.deepEqual(queries, ["primary", "compatible"]);

  const failingRequest: CommerceGraphqlRequester = async <T>(query: string) => query === "primary"
    ? {
        data: null,
        errors: [{ message: 'Cannot query field "seo" on type "ProductCategory".' }],
      }
    : {
        data: { archive: { id: "category-1" } } as T,
        errors: [{ message: "Archive resolver failed" }],
      };

  await assert.rejects(
    requestCommerceWithFallback(
      failingRequest,
      "primary",
      "compatible",
      {},
      isMissingProductOptionalFieldSchemaError,
    ),
    /Archive resolver failed/,
  );
});

test("brand directory treats an absent RootQuery connection as optional but surfaces other failures", async () => {
  const missingRoot: CommerceGraphqlRequester = async () => ({
    data: null,
    errors: [{ message: 'Cannot query field "productBrands" on type "RootQuery".' }],
  });
  assert.equal(await requestOptionalCommerceRoot(missingRoot, "brands", {}), null);

  const resolverFailure: CommerceGraphqlRequester = async <T>() => ({
    data: { productBrands: null } as T,
    errors: [{ message: "Brand resolver failed" }],
  });
  await assert.rejects(
    requestOptionalCommerceRoot(resolverFailure, "brands", {}),
    /Brand resolver failed/,
  );
});

test("strict compatibility error handling preserves every GraphQL error message", () => {
  assert.throws(
    () => assertNoCommerceGraphqlErrors([
      { message: "First failure" },
      { message: "Second failure" },
    ]),
    /First failure; Second failure/,
  );
});
