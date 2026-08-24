import { parseLocalizedPrice } from "@funky/ui/src/locale/pricing.ts";
import { resolveVariationSwatchColor } from "@funky/ui/src/catalog/variationSwatch.ts";
import type { ProductCardData } from "@funky/ui";
import type { ProductReview, ProductVariationCombo, ProductVariationOption } from "../pages/shared";
import {
  graphqlRequest,
  hasOnlyMissingGraphqlFields,
  STOREFRONT_BACKEND_PROFILE,
} from "@funky/sdk";
import {
  createCompatibleProductDetailQuery,
  createCoreProductDetailQuery,
  createProductQueryWithoutBrands,
  isMissingProductOptionalFieldSchemaError,
  requestCatalogWithFallback,
  requestCommerceWithFallback,
  requestCommerceWithFallbackChain,
  assertNoCommerceGraphqlErrors,
} from "./commerceGraphqlCompatibility.ts";
import {
  mapSeo,
  type CmsPageSeo,
  type CmsPageTranslation,
  type CmsPublicRobots,
  type RawCmsSeo,
} from "./pages.ts";
import {
  resolveCommerceProductType,
  type CommerceProductType,
} from "../../../../packages/commerce/src/productTypes.ts";
import { shouldPreferCoreGraphqlQueries } from "./profileGraphqlCompatibility.ts";
import { mapPublicEngagementRating, type PublicEngagementRatingSummary } from "./engagementRatings.ts";
import { normalizeProductPriceBehavior, type ProductPriceBehavior } from "./productPriceMode.ts";
import {
  mapLocalizedCatalogTerms,
  mapLocalizedTerms,
  type RawLocalizedTerm,
  type RawLocalizedTermTranslation,
} from "./commerceTaxonomyLanguage.ts";
import { ARCHIVE_BATCH_SIZE, fetchArchiveNodesInBatches, getArchivePageSize } from "./archiveSettings.ts";

export type { ProductPriceBehavior, ResolvedProductPriceMode } from "./productPriceMode.ts";
export { resolveProductPriceMode } from "./productPriceMode.ts";

export const COMMERCE_SOURCE_LANGUAGE = "pl";

export type { CommerceProductType } from "../../../../packages/commerce/src/productTypes.ts";
export type CommerceTaxonomy = "category" | "tag" | "brand";
export type CommerceTaxonomyIdentifierType = "URI" | "SLUG";

export type CmsProductCard = ProductCardData & {
  slug: string;
  uri: string;
  categorySlugs?: string[];
  tagSlugs?: string[];
  brandSlugs?: string[];
  commerceProductType: CommerceProductType;
  stockStatus: string | null;
  stockQuantity: number | null;
  inStock: boolean | null;
  engagementRating: PublicEngagementRatingSummary;
};

export type CmsProductTerm = {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  uri: string;
  descriptionHtml: string;
  count: number;
  imageUrl: string | null;
};

export type CmsProductImage = {
  id: string;
  sourceUrl: string;
  altText: string;
  title: string;
};

export type CmsProductAttribute = {
  id: string;
  name: string;
  label: string;
  options: string[];
  variation: boolean;
  visible: boolean;
};

export type CmsProductDetail = {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  uri: string;
  languageCode: string;
  translations: CmsPageTranslation[];
  card: CmsProductCard;
  shortDescriptionHtml: string;
  descriptionHtml: string;
  sku: string;
  /** Per-currency manual price overrides keyed by ISO currency code (e.g. "USD": 99.99).
   *  When present for the selected currency, use this instead of rate conversion. */
  currencyPrices: Record<string, number>;
  gallery: CmsProductImage[];
  attributes: CmsProductAttribute[];
  variationOptions: ProductVariationOption[];
  variationCombos: ProductVariationCombo[];
  categories: CmsProductTerm[];
  tags: CmsProductTerm[];
  brands: CmsProductTerm[];
  related: CmsProductCard[];
  upsells: CmsProductCard[];
  crossSells: CmsProductCard[];
  reviews: ProductReview[];
  seo: CmsPageSeo;
  externalButtonText: string | null;
  /** Per-product override of the store-wide "no price" behaviour ("inherit" defers to
   *  the store setting). Use {@link resolveProductPriceMode} to reconcile this with the
   *  product's actual price and the store-wide default. */
  priceBehavior: ProductPriceBehavior;
};

export type CmsCommerceReview = ProductReview & {
  productTitle: string;
  productUri: string;
};

export type CmsCommerceCatalog = {
  requestedLanguageCode: string;
  languageCode: string;
  usesSourceLanguageFallback: boolean;
  products: CmsProductCard[];
  categories: CmsProductTerm[];
  tags: CmsProductTerm[];
  brands: CmsProductTerm[];
  reviews: CmsCommerceReview[];
  hasMoreProducts: boolean;
};

export type CmsProductArchive = {
  taxonomy: CommerceTaxonomy;
  languageCode: string | null;
  translations: CmsPageTranslation[];
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  uri: string;
  descriptionHtml: string;
  count: number;
  imageUrl: string | null;
  products: CmsProductCard[];
  hasMoreProducts: boolean;
  siblings: CmsProductTerm[];
  seo: CmsPageSeo;
};

type RawImage = {
  id: string;
  sourceUrl: string | null;
  altText: string | null;
  title: string | null;
};

export type RawTermTranslation = RawLocalizedTermTranslation;
export type RawTerm = RawLocalizedTerm & { image?: RawImage | null };

type RawVariation = {
  id: string;
  databaseId: number;
  sku: string | null;
  price: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  stockStatus: string | null;
  stockQuantity: number | null;
  image: RawImage | null;
  attributes: {
    nodes: { id: string; name: string | null; label: string | null; value: string | null }[];
  } | null;
};

export type RawProductCard = {
  __typename: string;
  id: string;
  databaseId: number;
  slug: string | null;
  uri: string | null;
  name: string | null;
  shortDescription: string | null;
  engagementRating: PublicEngagementRatingSummary;
  featured: boolean | null;
  onSale: boolean | null;
  image: RawImage | null;
  galleryImages: { nodes: RawImage[] } | null;
  productCategories: { nodes: RawTerm[] } | null;
  productTags: { nodes: RawTerm[] } | null;
  productBrands: { nodes: RawTerm[] } | null;
  price?: string | null;
  regularPrice?: string | null;
  salePrice?: string | null;
  stockStatus?: string | null;
  stockQuantity?: number | null;
  externalUrl?: string | null;
  variations?: { nodes: RawVariation[] } | null;
};

type RawAttribute = {
  id: string;
  name: string | null;
  label: string | null;
  options: (string | null)[] | null;
  variation: boolean | null;
  visible: boolean | null;
};

type RawProductDetail = RawProductCard & {
  description: string | null;
  headlessDescription?: string | null;
  headlessShortDescription?: string | null;
  sku: string | null;
  currencyPrices?: string | null;
  priceBehavior?: string | null;
  language?: { code: string | null } | null;
  translations?: ({ databaseId: number; uri: string | null; language: { code: string | null } | null } | null)[] | null;
  attributes?: { nodes: RawAttribute[] } | null;
  related: { nodes: RawProductCard[] } | null;
  upsell: { nodes: RawProductCard[] } | null;
  crossSell?: { nodes: RawProductCard[] } | null;
  reviews: {
    nodes: {
      id: string;
      databaseId: number;
      content: string | null;
      date: string | null;
      parentId: string | null;
      parentDatabaseId: number | null;
      rating: number | null;
      author: { node: { name: string | null } } | null;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  } | null;
  seo?: RawCmsSeo | null;
  funkycommercePublicRobots?: CmsPublicRobots | null;
  buttonText?: string | null;
};

type CatalogResult = {
  products: { nodes: RawProductCard[]; pageInfo: { hasNextPage: boolean } } | null;
  productCategories: { nodes: RawTerm[] } | null;
  reviews: {
    nodes: {
      id: string;
      databaseId: number;
      content: string | null;
      date: string | null;
      rating: number | null;
      author: { node: { name: string | null } } | null;
      commentedOn: {
        node: {
          title: string | null;
          uri: string | null;
        } | null;
      } | null;
    }[];
  } | null;
};

type CatalogBrandsResult = {
  productBrands: { nodes: RawTerm[] } | null;
};

type CatalogTagsResult = {
  productTags: { nodes: RawTerm[] } | null;
};

type FeaturedProductResult = {
  products: { nodes: RawProductCard[] } | null;
};

type ProductBrandDirectoryResult = {
  productBrands: {
    nodes: RawTerm[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  } | null;
};

type ProductResult = { product: RawProductDetail | null };

type RawTaxonomySeo = Omit<RawCmsSeo, "schema"> & { schema: { raw: string | null } | null };

type ArchiveResult = {
  archive: (RawTerm & {
    products?: { nodes: RawProductCard[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } } | null;
    seo?: RawTaxonomySeo | null;
  }) | null;
  siblings: { nodes: RawTerm[] } | null;
  localizedProducts?: { nodes: RawProductCard[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } } | null;
};

const PRODUCT_CONCRETE_FIELDS = /* GraphQL */ `
  ... on SimpleProduct {
    price
    regularPrice
    salePrice
    stockStatus
    stockQuantity
  }
  ... on VariableProduct {
    price
    regularPrice
    salePrice
    variations(first: 50) {
      nodes {
        id
        databaseId
        sku
        price
        regularPrice
        salePrice
        stockStatus
        stockQuantity
        image {
          id
          sourceUrl
          altText
          title
        }
        attributes {
          nodes {
            id
            name
            label
            value
          }
        }
      }
    }
  }
  ... on ExternalProduct {
    price
    regularPrice
    salePrice
    externalUrl
  }
  ... on GroupProduct {
    price
    regularPrice
    salePrice
  }
`;

/** Reusable Product-interface selection used by catalog, archive, and relationship queries. */
export const PRODUCT_CARD_FIELDS = /* GraphQL */ `
  __typename
  id
  databaseId
  slug
  uri
  name
  shortDescription(format: RENDERED)
  engagementRating {
    average
    count
    guestCount
    authoredCount
    histogram
  }
  featured
  onSale
  image {
    id
    sourceUrl
    altText
    title
  }
  galleryImages(first: 12) {
    nodes {
      id
      sourceUrl
      altText
      title
    }
  }
  productCategories {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  productTags {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  productBrands {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  ${PRODUCT_CONCRETE_FIELDS}
`;

const PRODUCT_CARD_FRAGMENT = /* GraphQL */ `
  fragment StorefrontProductCard on Product {
    ${PRODUCT_CARD_FIELDS}
  }
`;

export const FEATURED_PRODUCT_QUERY = /* GraphQL */ `
  query StorefrontFeaturedProduct($language: LanguageCodeFilterEnum!) {
    products(first: 1, where: { featured: true, language: $language }) {
      nodes { ...StorefrontProductCard }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

export const COMPATIBLE_FEATURED_PRODUCT_QUERY = /* GraphQL */ `
  query StorefrontFeaturedProductCompatible {
    products(first: 1, where: { featured: true }) {
      nodes { ...StorefrontProductCard }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

export const PRODUCT_LIST_CARD_FIELDS = /* GraphQL */ `
  __typename
  id
  databaseId
  slug
  uri
  name
  shortDescription(format: RENDERED)
  engagementRating {
    average
    count
    guestCount
    authoredCount
    histogram
  }
  featured
  onSale
  image {
    id
    sourceUrl
    altText
    title
  }
  galleryImages(first: 12) {
    nodes {
      id
      sourceUrl
      altText
      title
    }
  }
  productCategories {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  productTags {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  productBrands {
    nodes {
      id
      databaseId
      name
      slug
      uri
    }
  }
  ... on SimpleProduct {
    price
    regularPrice
    salePrice
    stockStatus
    stockQuantity
  }
  ... on VariableProduct {
    price
    regularPrice
    salePrice
    variations(first: 50) {
      nodes {
        id
        databaseId
        sku
        price
        regularPrice
        salePrice
        stockStatus
        stockQuantity
        image {
          id
          sourceUrl
          altText
          title
        }
        attributes {
          nodes {
            id
            name
            label
            value
          }
        }
      }
    }
  }
  ... on ExternalProduct {
    price
    regularPrice
    salePrice
    externalUrl
  }
  ... on GroupProduct {
    price
    regularPrice
    salePrice
  }
`;

const PRODUCT_LIST_CARD_FRAGMENT = /* GraphQL */ `
  fragment StorefrontProductListCard on Product {
    ${PRODUCT_LIST_CARD_FIELDS}
  }
`;
const PRODUCT_LIST_CARD_FRAGMENT_WITHOUT_BRANDS = createProductQueryWithoutBrands(PRODUCT_LIST_CARD_FRAGMENT);

const TERM_FIELDS = /* GraphQL */ `
  id
  databaseId
  name
  slug
  uri
  description
  count
`;

const LOCALIZED_TERM_FIELDS = /* GraphQL */ `
  ${TERM_FIELDS}
  language { code }
  translations {
    id
    databaseId
    uri
    language { code }
  }
`;

const SEO_FIELDS = /* GraphQL */ `
  breadcrumbs { text url }
  canonical
  metaDesc
  metaKeywords
  metaRobotsNofollow
  metaRobotsNoindex
  opengraphAuthor
  opengraphDescription
  opengraphImage { sourceUrl }
  opengraphModifiedTime
  opengraphPublishedTime
  opengraphPublisher
  opengraphSiteName
  opengraphTitle
  opengraphType
  opengraphUrl
  schema { articleType pageType }
  title
  twitterDescription
  twitterTitle
`;

const TAXONOMY_SEO_FIELDS = /* GraphQL */ `
  breadcrumbs { text url }
  canonical
  metaDesc
  metaKeywords
  metaRobotsNofollow
  metaRobotsNoindex
  opengraphAuthor
  opengraphDescription
  opengraphImage { sourceUrl }
  opengraphModifiedTime
  opengraphPublishedTime
  opengraphPublisher
  opengraphSiteName
  opengraphTitle
  opengraphType
  opengraphUrl
  title
  twitterDescription
  twitterTitle
`;

export const CATALOG_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalog($language: LanguageCodeFilterEnum!) {
    products(first: 24, where: { language: $language }) {
      nodes { ...StorefrontProductListCard }
      pageInfo { hasNextPage }
    }
    productCategories(first: 50, where: { hideEmpty: true, language: $language }) {
      nodes {
        ${LOCALIZED_TERM_FIELDS}
        image { id sourceUrl altText title }
      }
    }
    reviews: comments(
      first: 20
      where: {
        contentType: [PRODUCT]
        parent: 0
        statusIn: [APPROVE]
        orderby: COMMENT_DATE
        order: DESC
      }
    ) {
      nodes {
        id
        databaseId
        content(format: RENDERED)
        date
        rating
        author { node { name } }
        commentedOn {
          node {
            ... on Product {
              title: name
              uri
            }
          }
        }
      }
    }
  }
  ${PRODUCT_LIST_CARD_FRAGMENT}
`;
const CATALOG_QUERY_WITHOUT_BRANDS = createProductQueryWithoutBrands(CATALOG_QUERY);

const COMPATIBLE_CATALOG_OPERATIONS = [
  {
    field: "products",
    query: /* GraphQL */ `
      query StorefrontCommerceCatalogCompatibleProducts {
        products(first: 24) {
          nodes { ...StorefrontProductListCard }
          pageInfo { hasNextPage }
        }
      }
      ${PRODUCT_LIST_CARD_FRAGMENT_WITHOUT_BRANDS}
    `,
  },
  {
    field: "productCategories",
    query: /* GraphQL */ `
      query StorefrontCommerceCatalogCompatibleCategories {
        productCategories(first: 50, where: { hideEmpty: true }) {
          nodes {
            ${TERM_FIELDS}
            image { id sourceUrl altText title }
          }
        }
      }
    `,
  },
  {
    field: "reviews",
    query: /* GraphQL */ `
      query StorefrontCommerceCatalogCompatibleReviews {
        reviews: comments(
          first: 20
          where: {
            contentType: [PRODUCT]
            parent: 0
            statusIn: [APPROVE]
            orderby: COMMENT_DATE
            order: DESC
          }
        ) {
          nodes {
            id
            databaseId
            content(format: RENDERED)
            date
            rating
            author { node { name } }
            commentedOn {
              node {
                ... on Product {
                  title: name
                  uri
                }
              }
            }
          }
        }
      }
    `,
  },
] as const;

export const CATALOG_TAGS_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalogTags($language: LanguageCodeFilterEnum!) {
    productTags(first: 50, where: { hideEmpty: true, language: $language }) {
      nodes { ${LOCALIZED_TERM_FIELDS} }
    }
  }
`;

export const COMPATIBLE_CATALOG_TAGS_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalogTagsCompatible {
    productTags(first: 50, where: { hideEmpty: true }) {
      nodes { ${TERM_FIELDS} }
    }
  }
`;

export const CATALOG_BRANDS_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalogBrands($language: LanguageCodeFilterEnum!) {
    productBrands(first: 50, where: { hideEmpty: true, language: $language }) {
      nodes {
        ${LOCALIZED_TERM_FIELDS}
        image { id sourceUrl altText title }
      }
    }
  }
`;

export const COMPATIBLE_CATALOG_BRANDS_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalogBrandsCompatible {
    productBrands(first: 50, where: { hideEmpty: true }) {
      nodes {
        ${TERM_FIELDS}
        image { id sourceUrl altText title }
      }
    }
  }
`;

export const PRODUCT_BRAND_DIRECTORY_QUERY = /* GraphQL */ `
  query StorefrontProductBrandDirectory($after: String, $language: LanguageCodeFilterEnum!) {
    productBrands(first: 100, after: $after, where: { hideEmpty: true, language: $language }) {
      nodes {
        ${LOCALIZED_TERM_FIELDS}
        image { id sourceUrl altText title }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const COMPATIBLE_PRODUCT_BRAND_DIRECTORY_QUERY = /* GraphQL */ `
  query StorefrontProductBrandDirectoryCompatible($after: String) {
    productBrands(first: 100, after: $after, where: { hideEmpty: true }) {
      nodes {
        ${TERM_FIELDS}
        image { id sourceUrl altText title }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCT_DETAIL_QUERY = /* GraphQL */ `
  query StorefrontProductDetail($slug: ID!) {
    product(id: $slug, idType: SLUG) {
      ...StorefrontProductCard
      description(format: RENDERED)
      headlessDescription
      headlessShortDescription
      sku
      currencyPrices
      priceBehavior
      language { code }
      translations {
        databaseId
        uri
        language { code }
      }
      reviews(first: 100) {
        nodes {
          id
          databaseId
          content(format: RENDERED)
          date
          parentId
          parentDatabaseId
          rating
          author { node { name } }
        }
        pageInfo { hasNextPage endCursor }
      }
      related(first: 12) { nodes { ...StorefrontProductCard } }
      upsell(first: 12) { nodes { ...StorefrontProductCard } }
      seo { ${SEO_FIELDS} }
      funkycommercePublicRobots { noindex nofollow }
      ... on SimpleProduct {
        attributes(first: 100) {
          nodes { id name label options variation visible }
        }
        crossSell(first: 12) { nodes { ...StorefrontProductCard } }
      }
      ... on VariableProduct {
        attributes(first: 100) {
          nodes { id name label options variation visible }
        }
        crossSell(first: 12) { nodes { ...StorefrontProductCard } }
      }
      ... on ExternalProduct {
        buttonText
        attributes(first: 100) {
          nodes { id name label options variation visible }
        }
      }
      ... on GroupProduct {
        attributes(first: 100) {
          nodes { id name label options variation visible }
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

const COMPATIBLE_PRODUCT_DETAIL_QUERY = createCompatibleProductDetailQuery(
  PRODUCT_DETAIL_QUERY,
  SEO_FIELDS,
);
const COMPATIBLE_PRODUCT_DETAIL_QUERY_WITHOUT_BRANDS = createProductQueryWithoutBrands(
  COMPATIBLE_PRODUCT_DETAIL_QUERY,
);
const CORE_PRODUCT_DETAIL_QUERY = createCoreProductDetailQuery(PRODUCT_DETAIL_QUERY);

const PRODUCT_REVIEWS_QUERY = /* GraphQL */ `
  query StorefrontProductReviews($id: ID!, $after: String) {
    product(id: $id, idType: DATABASE_ID) {
      reviews(first: 100, after: $after) {
        nodes {
          id
          databaseId
          content(format: RENDERED)
          date
          parentId
          parentDatabaseId
          rating
          author { node { name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const TAXONOMY_ARCHIVE_CONFIG: Record<CommerceTaxonomy, {
  field: string;
  idType: string;
  plural: string;
  productFilter: string;
  hasImage: boolean;
}> = {
  category: {
    field: "productCategory",
    idType: "ProductCategoryIdType",
    plural: "productCategories",
    productFilter: "category",
    hasImage: true,
  },
  tag: {
    field: "productTag",
    idType: "ProductTagIdType",
    plural: "productTags",
    productFilter: "tag",
    hasImage: false,
  },
  brand: {
    field: "productBrand",
    idType: "ProductBrandIdType",
    plural: "productBrands",
    productFilter: "productBrand",
    hasImage: true,
  },
};

export function archiveQuery(taxonomy: CommerceTaxonomy): string {
  const { field, idType, plural, productFilter, hasImage } = TAXONOMY_ARCHIVE_CONFIG[taxonomy];
  const image = hasImage ? "image { id sourceUrl altText title }" : "";

  return /* GraphQL */ `
    query StorefrontProductArchive($id: ID!, $idType: ${idType}!, $taxonomySlug: String!, $language: LanguageCodeFilterEnum!, $first: Int!, $after: String) {
      archive: ${field}(id: $id, idType: $idType) {
        ${LOCALIZED_TERM_FIELDS}
        ${image}
        seo { ${TAXONOMY_SEO_FIELDS} }
      }
      localizedProducts: products(first: $first, after: $after, where: { ${productFilter}: $taxonomySlug, language: $language }) {
        nodes { ...StorefrontProductListCard }
        pageInfo { hasNextPage endCursor }
      }
      siblings: ${plural}(first: 50, where: { hideEmpty: true, language: $language }) {
        nodes {
          ${LOCALIZED_TERM_FIELDS}
          ${image}
        }
      }
    }
    ${PRODUCT_LIST_CARD_FRAGMENT}
  `;
}

export function compatibleArchiveQuery(taxonomy: CommerceTaxonomy): string {
  const { field, idType, plural, hasImage } = TAXONOMY_ARCHIVE_CONFIG[taxonomy];
  const image = hasImage ? "image { id sourceUrl altText title }" : "";

  return /* GraphQL */ `
    query StorefrontProductArchiveCompatible($id: ID!, $idType: ${idType}!, $first: Int!, $after: String) {
      archive: ${field}(id: $id, idType: $idType) {
        ${TERM_FIELDS}
        ${image}
        products(first: $first, after: $after) {
          nodes { ...StorefrontProductListCard }
          pageInfo { hasNextPage endCursor }
        }
      }
      siblings: ${plural}(first: 50, where: { hideEmpty: true }) {
        nodes {
          ${TERM_FIELDS}
          ${image}
        }
      }
    }
    ${PRODUCT_LIST_CARD_FRAGMENT_WITHOUT_BRANDS}
  `;
}

export function compatibleLocalizedBrandArchiveQuery(): string {
  return /* GraphQL */ `
    query StorefrontProductBrandArchiveLocalizedProducts($id: ID!, $idType: ProductBrandIdType!, $brandSlug: String!, $language: LanguageCodeFilterEnum!, $first: Int!, $after: String) {
      archive: productBrand(id: $id, idType: $idType) {
        ${TERM_FIELDS}
        image { id sourceUrl altText title }
      }
      localizedProducts: products(first: $first, after: $after, where: { productBrand: $brandSlug, language: $language }) {
        nodes { ...StorefrontProductListCard }
        pageInfo { hasNextPage endCursor }
      }
      siblings: productBrands(first: 50, where: { hideEmpty: true }) {
        nodes {
          ${TERM_FIELDS}
          image { id sourceUrl altText title }
        }
      }
    }
    ${PRODUCT_LIST_CARD_FRAGMENT}
  `;
}

export async function getCommerceCatalog(languageCode: string, backendLanguageCode: string): Promise<CmsCommerceCatalog> {
  const requestedLanguageCode = languageCode.trim().toLowerCase();
  const languageCodeUsed = requestedLanguageCode;
  const preferCoreQueries = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE);
  const [
    {
      data,
      usesCompatibilityFallback: usesSourceLanguageFallback,
    },
    brandData,
    tagData,
  ] = await Promise.all([
    requestCatalogWithFallback<CatalogResult>(
      graphqlRequest,
      CATALOG_QUERY,
      { language: backendLanguageCode },
      COMPATIBLE_CATALOG_OPERATIONS,
      isMissingProductOptionalFieldSchemaError,
      preferCoreQueries,
      CATALOG_QUERY_WITHOUT_BRANDS,
    ),
    requestCommerceWithFallback<CatalogBrandsResult>(
      graphqlRequest,
      CATALOG_BRANDS_QUERY,
      COMPATIBLE_CATALOG_BRANDS_QUERY,
      { language: backendLanguageCode },
      isMissingProductOptionalFieldSchemaError,
      preferCoreQueries,
    ),
    requestCommerceWithFallback<CatalogTagsResult>(
      graphqlRequest,
      CATALOG_TAGS_QUERY,
      COMPATIBLE_CATALOG_TAGS_QUERY,
      { language: backendLanguageCode },
      isMissingProductOptionalFieldSchemaError,
      preferCoreQueries,
    ),
  ]);

  return {
    requestedLanguageCode,
    languageCode: usesSourceLanguageFallback ? COMMERCE_SOURCE_LANGUAGE : languageCodeUsed,
    usesSourceLanguageFallback,
    products: data.products?.nodes.map(mapProductCard) || [],
    categories: mapCatalogTerms(
      data.products?.nodes,
      data.productCategories?.nodes,
      usesSourceLanguageFallback ? undefined : languageCodeUsed,
    ),
    tags: mapTerms(tagData?.productTags?.nodes, languageCodeUsed),
    brands: mapCatalogTerms(
      data.products?.nodes,
      brandData?.productBrands?.nodes,
      usesSourceLanguageFallback ? undefined : languageCodeUsed,
      (product) => product.productBrands?.nodes,
    ),
    reviews:
      data.reviews?.nodes.flatMap((review) => {
        const product = review.commentedOn?.node;
        if (!product?.title || !product.uri) return [];
        return [{
          id: review.id,
          databaseId: review.databaseId,
          author: review.author?.node.name?.trim() || "Anonymous",
          content: htmlToText(review.content || ""),
          date: review.date || "",
          rating: normalizeRating(review.rating),
          productTitle: product.title,
          productUri: product.uri,
        }];
      }) || [],
    hasMoreProducts: data.products?.pageInfo.hasNextPage || false,
  };
}

export async function getFeaturedProduct(backendLanguageCode: string): Promise<CmsProductCard | null> {
  const data = await requestCommerceWithFallback<FeaturedProductResult>(
    graphqlRequest,
    FEATURED_PRODUCT_QUERY,
    COMPATIBLE_FEATURED_PRODUCT_QUERY,
    { language: backendLanguageCode },
    isMissingProductOptionalFieldSchemaError,
    shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE),
  );
  return data?.products?.nodes[0] ? mapProductCard(data.products.nodes[0]) : null;
}

export async function getProductBrandDirectory(
  languageCode = COMMERCE_SOURCE_LANGUAGE,
  backendLanguageCode = COMMERCE_SOURCE_LANGUAGE.toUpperCase(),
): Promise<CmsProductTerm[]> {
  const brands: RawTerm[] = [];
  let after: string | null = null;

  do {
    const pageData: ProductBrandDirectoryResult | null = await requestCommerceWithFallback<ProductBrandDirectoryResult>(
      graphqlRequest,
      PRODUCT_BRAND_DIRECTORY_QUERY,
      COMPATIBLE_PRODUCT_BRAND_DIRECTORY_QUERY,
      { after, language: backendLanguageCode },
      isMissingProductOptionalFieldSchemaError,
      shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE),
    );
    if (!pageData) return [];
    if (!pageData?.productBrands) throw new Error("The product brand directory query returned no data");

    brands.push(...pageData.productBrands.nodes);
    if (!pageData.productBrands.pageInfo.hasNextPage) break;
    if (!pageData.productBrands.pageInfo.endCursor) {
      throw new Error("The product brand directory query returned an incomplete pagination cursor");
    }
    after = pageData.productBrands.pageInfo.endCursor;
  } while (after);

  return mapTerms(brands, languageCode).sort((left, right) => left.name.localeCompare(right.name));
}

/** Accepts either a WooCommerce product slug or a `/product/<slug>/` URI. */
export async function getProductByUriOrSlug(identifier: string): Promise<CmsProductDetail | null> {
  const slug = productSlugFromIdentifier(identifier);
  if (!slug) return null;
  const primaryQuery = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE)
    ? CORE_PRODUCT_DETAIL_QUERY
    : PRODUCT_DETAIL_QUERY;
  const data = await requestCommerceWithFallbackChain<ProductResult>(
    graphqlRequest,
    primaryQuery === CORE_PRODUCT_DETAIL_QUERY
      ? [CORE_PRODUCT_DETAIL_QUERY, COMPATIBLE_PRODUCT_DETAIL_QUERY_WITHOUT_BRANDS]
      : [PRODUCT_DETAIL_QUERY, COMPATIBLE_PRODUCT_DETAIL_QUERY, COMPATIBLE_PRODUCT_DETAIL_QUERY_WITHOUT_BRANDS],
    { slug },
    isMissingProductOptionalFieldSchemaError,
  );
  if (!data) return null;
  if (!data.product) return null;

  const product = await loadRemainingProductReviews(data.product);
  const variations = product.variations?.nodes || [];
  const attributes = mapAttributes(product.attributes?.nodes);
  const card = mapProductCard(product);
  const mainImage = mapImage(product.image);
  const gallery = [
    mainImage,
    ...(product.galleryImages?.nodes.map(mapImage) || []),
    ...variations.map((variation) => mapImage(variation.image)),
  ].filter(
    (image): image is CmsProductImage => image !== null,
  );

  return normalizeProductDetail({
    id: product.id,
    databaseId: product.databaseId,
    name: card.name,
    slug: product.slug || slug,
    uri: product.uri || `/product/${slug}/`,
    languageCode: product.language?.code?.toLowerCase() || COMMERCE_SOURCE_LANGUAGE,
    translations:
      product.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language.code.toLowerCase(),
            }]
          : [],
      ) || [],
    card,
    shortDescriptionHtml: product.headlessShortDescription || product.shortDescription || "",
    descriptionHtml: product.headlessDescription || product.description || "",
    sku: product.sku || "",
    currencyPrices: parseCurrencyPrices(product.currencyPrices),
    gallery: dedupeBy(gallery, ({ id }) => id),
    attributes,
    variationOptions: mapVariationOptions(attributes, variations),
    variationCombos: variations.map((variation) => mapVariationCombo(variation, attributes)),
    categories: mapTerms(product.productCategories?.nodes),
    tags: mapTerms(product.productTags?.nodes),
    brands: mapTerms(product.productBrands?.nodes),
    related: product.related?.nodes.map(mapProductCard) || [],
    upsells: product.upsell?.nodes.map(mapProductCard) || [],
    crossSells: product.crossSell?.nodes.map(mapProductCard) || [],
    reviews:
      product.reviews?.nodes.map((review) => ({
        id: review.id,
        databaseId: review.databaseId,
        author: review.author?.node.name?.trim() || "Anonymous",
        date: review.date || "",
        content: htmlToText(review.content || ""),
        parentId: review.parentId,
        parentDatabaseId: review.parentDatabaseId,
        rating: normalizeRating(review.rating),
      })) || [],
    seo: mapSeo(product.seo, product.funkycommercePublicRobots),
    externalButtonText: product.buttonText?.trim() || null,
    priceBehavior: normalizeProductPriceBehavior(product.priceBehavior),
  });
}

async function loadRemainingProductReviews(product: RawProductDetail): Promise<RawProductDetail> {
  if (!product.reviews) return product;

  const reviews = [...product.reviews.nodes];
  let pageInfo = product.reviews.pageInfo;

  while (pageInfo.hasNextPage) {
    if (!pageInfo.endCursor) {
      throw new Error("The product review query returned an incomplete pagination cursor");
    }
    const { data, errors } = await graphqlRequest<{
      product: Pick<RawProductDetail, "reviews"> | null;
    }>(PRODUCT_REVIEWS_QUERY, {
      id: String(product.databaseId),
      after: pageInfo.endCursor,
    });
    throwQueryErrors(errors, data);
    if (!data?.product?.reviews) {
      throw new Error("The product review pagination query returned no product");
    }

    reviews.push(...data.product.reviews.nodes);
    pageInfo = data.product.reviews.pageInfo;
  }

  return {
    ...product,
    reviews: {
      nodes: reviews,
      pageInfo,
    },
  };
}

function parseCurrencyPrices(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const result: Record<string, number> = {};
      for (const [code, value] of Object.entries(parsed)) {
        const price = typeof value === "number" ? value : parseFloat(String(value));
        if (Number.isFinite(price) && price > 0) {
          result[code.toUpperCase()] = price;
        }
      }
      return result;
    }
  } catch {
    // Fall through to empty map.
  }
  return {};
}

export function normalizeProductDetail(product: CmsProductDetail): CmsProductDetail {
  return {
    ...product,
    translations: product.translations || [],
    currencyPrices: product.currencyPrices || {},
    priceBehavior: normalizeProductPriceBehavior(product.priceBehavior),
    gallery: product.gallery || [],
    attributes: product.attributes || [],
    variationOptions: product.variationOptions || [],
    variationCombos: product.variationCombos || [],
    categories: product.categories || [],
    tags: product.tags || [],
    brands: product.brands || [],
    related: product.related || [],
    upsells: product.upsells || [],
    crossSells: product.crossSells || [],
    reviews: product.reviews || [],
  };
}

const TAXONOMY_FALLBACK_NAME: Record<CommerceTaxonomy, string> = {
  category: "Product category",
  tag: "Product tag",
  brand: "Product brand",
};

export async function getProductArchive(
  taxonomy: CommerceTaxonomy,
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
  languageCode = COMMERCE_SOURCE_LANGUAGE,
  backendLanguageCode = COMMERCE_SOURCE_LANGUAGE.toUpperCase(),
): Promise<CmsProductArchive | null> {
  const targetCount = await getArchivePageSize();
  const initialFirst = Math.min(targetCount, ARCHIVE_BATCH_SIZE);
  const preferCoreQueries = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE);
  const compatibleQuery = compatibleArchiveQuery(taxonomy);
  const scopedQueryWithoutBrands = createProductQueryWithoutBrands(archiveQuery(taxonomy));
  const queries = preferCoreQueries
    ? [compatibleQuery]
    : taxonomy === "brand"
      ? [archiveQuery(taxonomy), scopedQueryWithoutBrands, compatibleLocalizedBrandArchiveQuery(), compatibleQuery]
      : [archiveQuery(taxonomy), scopedQueryWithoutBrands, compatibleQuery];
  const identifiers = idType === "URI"
    ? [
        { id: identifier, idType },
        { id: productSlugFromIdentifier(identifier), idType: "SLUG" as const },
      ]
    : [{ id: identifier, idType }];
  let data: ArchiveResult | null = null;
  let initialData: ArchiveResult | null = null;
  let resolvedQuery: string | null = null;
  let resolvedIdentifier: (typeof identifiers)[number] | null = null;

  for (const candidate of identifiers) {
    let candidateQuery: string | null = null;
    data = await requestCommerceWithFallbackChain<ArchiveResult>(
      async <T>(query: string, variables?: Record<string, unknown>) => {
        candidateQuery = query;
        return graphqlRequest<T>(query, variables);
      },
      queries,
      {
        id: candidate.id,
        idType: candidate.idType,
        brandSlug: productSlugFromIdentifier(identifier),
        taxonomySlug: productSlugFromIdentifier(identifier),
        language: backendLanguageCode,
        first: initialFirst,
        after: null,
      },
      isMissingProductOptionalFieldSchemaError,
    );
    if (data?.archive) {
      initialData = data;
      resolvedQuery = candidateQuery;
      resolvedIdentifier = candidate;
    }
    if (data?.archive) break;
  }
  if (!initialData?.archive || !resolvedQuery || !resolvedIdentifier) return null;

  const loadArchivePage = async (first: number, after: string | null): Promise<ArchiveResult> => {
    const { data, errors } = await graphqlRequest<ArchiveResult>(resolvedQuery, {
      id: resolvedIdentifier.id,
      idType: resolvedIdentifier.idType,
      brandSlug: productSlugFromIdentifier(identifier),
      taxonomySlug: productSlugFromIdentifier(identifier),
      language: backendLanguageCode,
      first,
      after,
    });
    assertNoCommerceGraphqlErrors(errors);
    if (!data) {
      throw new Error(`The ${taxonomy} archive pagination query returned no data`);
    }
    if (!data.archive) {
      throw new Error(`The ${taxonomy} archive pagination query returned no archive`);
    }
    return data;
  };

  let firstPageData: ArchiveResult | null = initialData;
  const { nodes: products, hasMore } = await fetchArchiveNodesInBatches<RawProductCard>(
    targetCount,
    async (first, after) => {
      const pageData = firstPageData || await loadArchivePage(first, after);
      firstPageData = null;
      const archiveProducts = pageData.localizedProducts || pageData.archive?.products;
      return {
        nodes: archiveProducts?.nodes || [],
        pageInfo: archiveProducts?.pageInfo || { hasNextPage: false },
      };
    },
  );

  const archive = initialData.archive;
  const archiveLanguageCode = archive.language?.code?.toLowerCase() || null;
  return {
    taxonomy,
    languageCode: archiveLanguageCode,
    translations:
      archive.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language.code.toLowerCase(),
            }]
          : [],
      ) || [],
    id: archive.id,
    databaseId: archive.databaseId,
    name: archive.name?.trim() || TAXONOMY_FALLBACK_NAME[taxonomy],
    slug: archive.slug || "",
    uri: archive.uri || identifier,
    descriptionHtml: archive.description || "",
    count: archive.count || 0,
    imageUrl: archive.image?.sourceUrl || null,
    products: products.map(mapProductCard),
    hasMoreProducts: hasMore,
    siblings: mapTerms(initialData.siblings?.nodes, archiveLanguageCode || languageCode.trim().toLowerCase()),
    seo: mapTaxonomySeo(archive.seo || null),
  };
}

export function getProductCategoryArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
  languageCode?: string,
  backendLanguageCode?: string,
): Promise<CmsProductArchive | null> {
  return getProductArchive("category", identifier, idType, languageCode, backendLanguageCode);
}

export function getProductTagArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
  languageCode?: string,
  backendLanguageCode?: string,
): Promise<CmsProductArchive | null> {
  return getProductArchive("tag", identifier, idType, languageCode, backendLanguageCode);
}

export function getProductBrandArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
  languageCode?: string,
  backendLanguageCode?: string,
): Promise<CmsProductArchive | null> {
  return getProductArchive("brand", identifier, idType, languageCode, backendLanguageCode);
}

export function mapProductCard(product: RawProductCard): CmsProductCard {
  const commerceProductType = resolveCommerceProductType(product.__typename);
  const variations = product.variations?.nodes || [];
  const variableStock = deriveVariationStock(variations);
  const stockStatus = commerceProductType === "variable" ? variableStock.stockStatus : product.stockStatus || null;
  const stockQuantity = commerceProductType === "variable" ? variableStock.stockQuantity : product.stockQuantity ?? null;
  const price = decodePrice(product.salePrice || product.price || product.regularPrice || "");
  const regularPrice = decodePrice(product.regularPrice || "");
  const priceAmount = parseLocalizedPrice(price) ?? undefined;
  const regularPriceAmount = parseLocalizedPrice(regularPrice) ?? undefined;
  const imageUrls = product.galleryImages?.nodes.flatMap((image) => image.sourceUrl ? [image.sourceUrl] : []) || [];
  const category = product.productCategories?.nodes.find((term) => term.name);
  const brand = product.productBrands?.nodes.find((term) => term.name);
  const engagementRating = mapPublicEngagementRating(product.engagementRating);

  return {
    id: product.id,
    databaseId: product.databaseId,
    featured: product.featured === true,
    href: product.uri || (product.slug ? `/product/${product.slug}/` : undefined),
    slug: product.slug || "",
    uri: product.uri || (product.slug ? `/product/${product.slug}/` : ""),
    categorySlugs: product.productCategories?.nodes.flatMap((term) => term.slug ? [term.slug] : []) || [],
    tagSlugs: product.productTags?.nodes.flatMap((term) => term.slug ? [term.slug] : []) || [],
    brandSlugs: product.productBrands?.nodes.flatMap((term) => term.slug ? [term.slug] : []) || [],
    name: product.name?.trim() || "Untitled product",
    subtitle: htmlToText(product.shortDescription || "") || undefined,
    imageUrl: product.image?.sourceUrl || undefined,
    gallery: imageUrls.length ? imageUrls : undefined,
    brand: brand?.name || undefined,
    brandHref: brand?.uri || undefined,
    category: category?.name || undefined,
    categoryHref: category?.uri || undefined,
    priceLabel: price,
    priceAmount,
    compareAtPriceLabel: product.salePrice && regularPrice && regularPrice !== price ? regularPrice : undefined,
    compareAtPriceAmount: product.salePrice && regularPriceAmount !== priceAmount ? regularPriceAmount : undefined,
    priceRangeLabel: commerceProductType === "variable" ? price || undefined : undefined,
    rating: engagementRating.average ?? undefined,
    reviewCount: engagementRating.count,
    engagementRating,
    badge: product.onSale ? "Sale" : undefined,
    isNew: false,
    productType: commerceProductType,
    externalUrl: commerceProductType === "external" ? product.externalUrl || undefined : undefined,
    variationOptions:
      commerceProductType === "variable"
        ? mapCardVariationOptions(product.variations?.nodes || [], product.image, product.galleryImages?.nodes || [])
        : undefined,
    variations:
      commerceProductType === "variable"
        ? variations.map((variation) => {
            const priceLabel = decodePrice(variation.salePrice || variation.price || variation.regularPrice || "");
            const regularPriceLabel = decodePrice(variation.regularPrice || "");
            const variationPriceAmount = parseLocalizedPrice(priceLabel) ?? undefined;
            const variationRegularPriceAmount = parseLocalizedPrice(regularPriceLabel) ?? undefined;
            return {
              id: variation.id,
              databaseId: variation.databaseId,
              attributes: Object.fromEntries(
                variation.attributes?.nodes.flatMap((attribute) => {
                  const label = attribute.label || attribute.name;
                  return label && attribute.value ? [[label, attribute.value]] : [];
                }) || [],
              ),
              priceLabel,
              priceAmount: variationPriceAmount,
              compareAtPriceLabel:
                variation.salePrice && regularPriceLabel && regularPriceLabel !== priceLabel
                  ? regularPriceLabel
                  : undefined,
              compareAtPriceAmount:
                variation.salePrice && variationRegularPriceAmount !== variationPriceAmount
                  ? variationRegularPriceAmount
                  : undefined,
              imageUrl: variation.image?.sourceUrl || undefined,
              sku: variation.sku || undefined,
              inStock:
                variation.stockStatus === "IN_STOCK" ||
                (variation.stockQuantity !== null && variation.stockQuantity > 0),
              stockQuantity: variation.stockQuantity,
            };
          })
        : undefined,
    commerceProductType,
    stockStatus,
    stockQuantity,
    inStock:
      stockStatus === null && stockQuantity === null
        ? true
        : stockStatus === "IN_STOCK" || (stockQuantity !== null && stockQuantity > 0),
  };
}

function deriveVariationStock(variations: RawVariation[]): {
  stockStatus: string | null;
  stockQuantity: number | null;
} {
  if (!variations.length) return { stockStatus: null, stockQuantity: null };
  const purchasable = variations.filter((variation) =>
    variation.stockStatus === "IN_STOCK" || (variation.stockQuantity !== null && variation.stockQuantity > 0),
  );
  const quantities = variations.flatMap((variation) =>
    variation.stockQuantity === null ? [] : [variation.stockQuantity],
  );
  return {
    stockStatus: purchasable.length ? "IN_STOCK" : "OUT_OF_STOCK",
    stockQuantity: quantities.length ? quantities.reduce((total, quantity) => total + quantity, 0) : null,
  };
}

function mapAttributes(attributes: RawAttribute[] | undefined): CmsProductAttribute[] {
  return (attributes || []).map((attribute) => ({
    id: attribute.id,
    name: attribute.name || "",
    label: attribute.label || attribute.name || "",
    options: attribute.options?.filter((option): option is string => Boolean(option)) || [],
    variation: attribute.variation || false,
    visible: attribute.visible || false,
  }));
}

function mapVariationOptions(
  attributes: CmsProductAttribute[],
  variations: RawVariation[],
): ProductVariationOption[] {
  const variationValues = new Map<string, Set<string>>();
  variations.forEach((variation) => {
    variation.attributes?.nodes.forEach((attribute) => {
      const label = canonicalAttributeLabel(attribute.name, attribute.label, attributes);
      if (!label || !attribute.value) return;
      const values = variationValues.get(label) || new Set<string>();
      values.add(attribute.value);
      variationValues.set(label, values);
    });
  });

  const options = attributes
    .filter((attribute) => attribute.variation)
    .map((attribute) => {
      const label = attribute.label || attribute.name;
      const values = attribute.options.length
        ? attribute.options
        : [...(variationValues.get(label) || [])];
      const swatches = Object.fromEntries(
        values.flatMap((value) => {
          const color = resolveVariationSwatchColor(label, value);
          return color ? [[value, color]] : [];
        }),
      );
      return { label, values, ...(Object.keys(swatches).length ? { swatches } : {}) };
    })
    .filter((attribute) => attribute.label && attribute.values.length);
  if (options.length) return options;
  return [...variationValues].map(([label, optionValues]) => {
    const values = [...optionValues];
    const swatches = Object.fromEntries(
      values.flatMap((value) => {
        const color = resolveVariationSwatchColor(label, value);
        return color ? [[value, color]] : [];
      }),
    );
    return { label, values, ...(Object.keys(swatches).length ? { swatches } : {}) };
  });
}

function mapVariationCombo(
  variation: RawVariation,
  attributes: CmsProductAttribute[],
): ProductVariationCombo {
  const price = decodePrice(variation.salePrice || variation.price || variation.regularPrice || "");
  const regularPrice = decodePrice(variation.regularPrice || "");
  const priceAmount = parseLocalizedPrice(price) ?? undefined;
  const regularPriceAmount = parseLocalizedPrice(regularPrice) ?? undefined;
  return {
    id: variation.id,
    databaseId: variation.databaseId,
    options: Object.fromEntries(
      variation.attributes?.nodes.flatMap((attribute) => {
        const label = canonicalAttributeLabel(attribute.name, attribute.label, attributes);
        return label && attribute.value ? [[label, attribute.value]] : [];
      }) || [],
    ),
    priceLabel: price,
    priceAmount,
    compareAtPriceLabel:
      variation.salePrice && regularPrice && regularPrice !== price ? regularPrice : undefined,
    compareAtPriceAmount:
      variation.salePrice && regularPriceAmount !== priceAmount ? regularPriceAmount : undefined,
    imageId: variation.image?.sourceUrl ? variation.image.id : undefined,
    imageUrl: variation.image?.sourceUrl || undefined,
    sku: variation.sku || "",
    inStock:
      variation.stockStatus === "IN_STOCK" ||
      (variation.stockQuantity !== null && variation.stockQuantity > 0),
    stockQuantity: variation.stockQuantity,
  };
}

function canonicalAttributeLabel(
  name: string | null,
  label: string | null,
  attributes: CmsProductAttribute[],
): string | null {
  const key = (name || label)?.toLocaleLowerCase();
  const definition = attributes.find((attribute) =>
    attribute.name.toLocaleLowerCase() === key || attribute.label.toLocaleLowerCase() === key,
  );
  return definition?.label || label || name;
}

function mapCardVariationOptions(
  variations: RawVariation[],
  mainImage: RawImage | null,
  gallery: RawImage[],
): NonNullable<ProductCardData["variationOptions"]> {
  const images = [mainImage, ...gallery];
  const values = new Map<string, Map<string, number | undefined>>();
  variations.forEach((variation) => {
    variation.attributes?.nodes.forEach((attribute) => {
      const label = attribute.label || attribute.name;
      if (!label || !attribute.value) return;
      const imageIndex = variation.image?.sourceUrl
        ? images.findIndex((image) => image?.sourceUrl === variation.image?.sourceUrl)
        : -1;
      const option = values.get(label) || new Map<string, number | undefined>();
      if (!option.has(attribute.value)) option.set(attribute.value, imageIndex >= 0 ? imageIndex : undefined);
      values.set(label, option);
    });
  });
  return [...values].map(([label, optionValues]) => ({
    label,
    values: [...optionValues].map(([value, imageIndex]) => {
      const swatchColor = resolveVariationSwatchColor(label, value);
      return {
        label: value,
        ...(swatchColor ? { swatchColor } : {}),
        ...(imageIndex === undefined ? {} : { imageIndex }),
      };
    }),
  }));
}

export function mapTerms(terms: RawTerm[] | undefined, languageCode?: string): CmsProductTerm[] {
  return mapLocalizedTerms(terms, languageCode);
}

export function mapCatalogTerms(
  products: RawProductCard[] | undefined,
  listingTerms: RawTerm[] | undefined,
  languageCode?: string,
  termsOf: (product: RawProductCard) => RawTerm[] | undefined = (product) => product.productCategories?.nodes,
): CmsProductTerm[] {
  return mapLocalizedCatalogTerms(
    products,
    listingTerms,
    languageCode,
    termsOf,
  );
}

function mapImage(image: RawImage | null): CmsProductImage | null {
  if (!image?.sourceUrl) return null;
  return {
    id: image.id,
    sourceUrl: image.sourceUrl,
    altText: image.altText || "",
    title: image.title || "",
  };
}

function mapTaxonomySeo(seo: RawTaxonomySeo | null): CmsPageSeo {
  if (!seo) return { ...mapSeo(null), robots: "index, follow" };
  const { schema: _schema, ...common } = seo;
  return { ...mapSeo({ ...common, schema: null }), robots: "index, follow" };
}

function productSlugFromIdentifier(identifier: string): string {
  const clean = identifier.trim().split(/[?#]/, 1)[0].replace(/^https?:\/\/[^/]+/i, "");
  const parts = clean.split("/").filter(Boolean);
  const productIndex = parts.lastIndexOf("product");
  const value = (productIndex >= 0 ? parts[productIndex + 1] : parts[parts.length - 1]) || "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodePrice(value: string): string {
  return decodeHtmlEntities(value).replace(/<[^>]*>/g, "").trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    euro: "€",
    gt: ">",
    hellip: "…",
    laquo: "«",
    lt: "<",
    nbsp: "\u00a0",
    ndash: "–",
    pound: "£",
    quot: "\"",
    raquo: "»",
    times: "×",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const point = Number.parseInt(code[1].toLowerCase() === "x" ? code.slice(2) : code.slice(1), code[1].toLowerCase() === "x" ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeRating(rating: number | null): number | undefined {
  return rating && rating >= 1 && rating <= 5 ? rating : undefined;
}

/** WPGraphQL can return `errors` alongside otherwise-usable `data` — e.g. a single
 * broken relation (a stale Polylang translation link, in production) fails resolution
 * for just that one field while the rest of the response (the product itself, its
 * brand, etc.) resolves fine. Per the GraphQL spec, `errors` doesn't mean the whole
 * response is unusable, so only treat it as fatal when there's no data to fall back
 * on — otherwise a single unrelated field failing would take down the entire page. */
function throwQueryErrors(errors: { message: string }[] | undefined, data: unknown): void {
  if (data != null) return;
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
}

function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}
