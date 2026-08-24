import { hasOnlyMissingGraphqlFields } from "@funky/sdk";
import { removeGraphqlFieldSelections } from "./graphqlFieldFallback.ts";

export type CommerceGraphqlResponse<T> = {
  data: T | null;
  errors?: { message: string }[];
};

export type CommerceGraphqlRequester = <T>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<CommerceGraphqlResponse<T>>;

const PRODUCT_ROOT_COMPATIBILITY_FIELDS = [
  "product",
  "products",
  "productCategories",
  "productTags",
  "productBrands",
  "productCategory",
  "productTag",
  "productBrand",
] as const;

const PRODUCT_OPTIONAL_FIELD_COMPATIBILITY_FIELDS = [
  "language",
  "translations",
  "seo",
  "headlessDescription",
  "headlessShortDescription",
  "buttonText",
  "currencyPrices",
  "priceBehavior",
  "funkycommercePublicRobots",
] as const;

const PRODUCT_SCHEMA_COMPATIBILITY_TYPES = [
  "Product",
  "SimpleProduct",
  "VariableProduct",
  "ExternalProduct",
  "GroupProduct",
  "ProductCategory",
  "ProductTag",
  "ProductBrand",
  "ProductCategoryIdType",
  "ProductTagIdType",
  "ProductBrandIdType",
] as const;

export function createCompatibleProductDetailQuery(query: string, seoFields: string): string {
  return query
    .replace("\n      headlessDescription", "")
    .replace("\n      headlessShortDescription", "")
    .replace("\n      currencyPrices", "")
    .replace("\n      priceBehavior", "")
    .replace(
      `
      language { code }
      translations {
        databaseId
        uri
        language { code }
      }`,
      "",
    )
    .replace(`\n      seo { ${seoFields} }`, "")
    .replace("\n        buttonText", "")
    .replace("\n      funkycommercePublicRobots { noindex nofollow }", "");
}

export function createCoreProductDetailQuery(query: string): string {
  return ["language", "translations", "seo", "funkycommercePublicRobots"].reduce(removeGraphqlFieldSelections, query);
}

export function createProductQueryWithoutBrands(query: string): string {
  return removeGraphqlFieldSelections(query, "productBrands");
}

function isMissingProductRootFieldError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return PRODUCT_ROOT_COMPATIBILITY_FIELDS.some((fieldName) => {
    const normalizedFieldName = fieldName.toLowerCase();
    return (
      normalizedMessage.includes(`cannot query field "${normalizedFieldName}" on type "rootquery"`)
      || normalizedMessage.includes(`field "${normalizedFieldName}" is not defined by type "rootquery"`)
    );
  });
}

function isMissingProductBrandRootFieldError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return ["productbrand", "productbrands"].some((fieldName) => (
    normalizedMessage.includes(`cannot query field "${fieldName}" on type "rootquery"`)
    || normalizedMessage.includes(`field "${fieldName}" is not defined by type "rootquery"`)
  ));
}

function isMissingProductBrandTypeError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('unknown type "productbrand"')
    || normalizedMessage.includes('unknown type "productbrandidtype"');
}

function isMissingProductBrandWhereFieldError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return /(?:field "productbrand" is not defined by type|cannot query field "productbrand" on type) "rootquerytoproduct(?:union)?connectionwhereargs"/.test(
    normalizedMessage,
  );
}

export function isMissingProductBrandSchemaError(errors: { message: string }[] | undefined): boolean {
  return Boolean(
    errors?.length
    && errors.some(({ message }) => isMissingProductBrandRootFieldError(message))
    && errors.every(({ message }) => (
      isMissingProductBrandRootFieldError(message)
      || isMissingProductBrandTypeError(message)
      || isMissingProductBrandWhereFieldError(message)
      || /cannot query field "productbrands" on type "(?:product|simpleproduct|variableproduct|externalproduct|groupproduct)"/i.test(message)
      || isDanglingProductLanguageTypeError(message)
      || hasOnlyMissingGraphqlFields([{ message }], PRODUCT_OPTIONAL_FIELD_COMPATIBILITY_FIELDS)
    )),
  );
}

function isMissingProductSchemaTypeError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return PRODUCT_SCHEMA_COMPATIBILITY_TYPES.some((typeName) =>
    normalizedMessage.includes(`unknown type "${typeName.toLowerCase()}"`),
  );
}

function isMissingProductContentTypeError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('value "product" does not exist in "contenttypeenum" enum');
}

function isDanglingProductLanguageTypeError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("field &#039;language&#039; on type &#039;product&#039;")
    && normalizedMessage.includes("&#039;contentlanguage&#039;")
    && normalizedMessage.includes("non-existent type");
}

export function isMissingProductRootSchemaError(errors: { message: string }[] | undefined): boolean {
  if (isMissingProductBrandSchemaError(errors)) return true;
  return Boolean(
    errors?.length
    && errors.some(({ message }) => isMissingProductRootFieldError(message))
    && errors.every(({ message }) => (
      isMissingProductRootFieldError(message)
      || isMissingProductSchemaTypeError(message)
      || isMissingProductContentTypeError(message)
      || hasOnlyMissingGraphqlFields([{ message }], PRODUCT_OPTIONAL_FIELD_COMPATIBILITY_FIELDS)
    )),
  );
}

export function isMissingProductOptionalFieldSchemaError(errors: { message: string }[] | undefined): boolean {
  return Boolean(errors?.length) && Boolean(errors?.every(({ message }) => (
    isDanglingProductLanguageTypeError(message)
    || /cannot query field "productbrands" on type "(?:product|simpleproduct|variableproduct|externalproduct|groupproduct)"/i.test(message)
    || hasOnlyMissingGraphqlFields([{ message }], PRODUCT_OPTIONAL_FIELD_COMPATIBILITY_FIELDS)
  )));
}

export function assertNoCommerceGraphqlErrors(errors: { message: string }[] | undefined): void {
  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
}

export async function requestOptionalCommerceRoot<T>(
  request: CommerceGraphqlRequester,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  const response = await request<T>(query, variables);
  if (isMissingProductRootSchemaError(response.errors)) return null;
  assertNoCommerceGraphqlErrors(response.errors);
  if (!response.data) throw new Error("The GraphQL query returned no data");
  return response.data;
}

export async function requestCommerceWithFallback<T>(
  request: CommerceGraphqlRequester,
  primaryQuery: string,
  compatibleQuery: string,
  variables: Record<string, unknown>,
  shouldRetry: (errors: { message: string }[] | undefined) => boolean,
  preferCompatible = false,
): Promise<T | null> {
  return requestCommerceWithFallbackChain(
    request,
    preferCompatible ? [compatibleQuery] : [primaryQuery, compatibleQuery],
    variables,
    shouldRetry,
  );
}

export async function requestCommerceWithFallbackChain<T>(
  request: CommerceGraphqlRequester,
  queries: readonly string[],
  variables: Record<string, unknown>,
  shouldRetry: (errors: { message: string }[] | undefined) => boolean,
): Promise<T | null> {
  if (!queries.length) throw new Error("At least one GraphQL query is required");

  let response: CommerceGraphqlResponse<T> | undefined;
  for (const [index, query] of queries.entries()) {
    response = await request<T>(query, variables);
    if (isMissingProductRootSchemaError(response.errors)) return null;
    if (!shouldRetry(response.errors) || index === queries.length - 1) break;
  }

  assertNoCommerceGraphqlErrors(response?.errors);
  if (!response?.data) throw new Error("The GraphQL query returned no data");
  return response.data;
}

export async function requestCompatibleCatalog<T extends Record<string, unknown>>(
  request: CommerceGraphqlRequester,
  operations: readonly { field: keyof T; query: string }[],
): Promise<T> {
  const result: Partial<T> = {};

  const resolved = await Promise.all(operations.map(async ({ field, query }) => {
    const response = await request<Pick<T, typeof field>>(query, {});
    if (
      isMissingProductRootSchemaError(response.errors)
      || (
        String(field) === "reviews"
        && Boolean(response.errors?.length)
        && response.errors?.every(({ message }) => (
          isMissingProductContentTypeError(message)
          || isMissingProductSchemaTypeError(message)
        ))
      )
    ) {
      return [field, null as T[typeof field]] as const;
    }
    assertNoCommerceGraphqlErrors(response.errors);
    if (!response.data) throw new Error(`The compatible catalog ${String(field)} query returned no data`);
    return [field, response.data[field]] as const;
  }));
  for (const [field, value] of resolved) {
    result[field] = value;
  }

  return result as T;
}

export async function requestCatalogWithFallback<T extends Record<string, unknown>>(
  request: CommerceGraphqlRequester,
  primaryQuery: string,
  variables: Record<string, unknown>,
  compatibleOperations: readonly { field: keyof T; query: string }[],
  shouldRetry: (errors: { message: string }[] | undefined) => boolean,
  preferCompatible = false,
  scopedCompatibleQuery?: string,
): Promise<{ data: T; usesCompatibilityFallback: boolean }> {
  if (preferCompatible) {
    return {
      data: await requestCompatibleCatalog<T>(request, compatibleOperations),
      usesCompatibilityFallback: true,
    };
  }
  let response = await request<T>(primaryQuery, variables);
  if (scopedCompatibleQuery && shouldRetry(response.errors)) {
    response = await request<T>(scopedCompatibleQuery, variables);
  }
  if (isMissingProductRootSchemaError(response.errors) || shouldRetry(response.errors)) {
    return {
      data: await requestCompatibleCatalog<T>(request, compatibleOperations),
      usesCompatibilityFallback: true,
    };
  }
  assertNoCommerceGraphqlErrors(response.errors);
  if (!response.data) throw new Error("The commerce catalog query returned no data");
  return { data: response.data, usesCompatibilityFallback: false };
}
