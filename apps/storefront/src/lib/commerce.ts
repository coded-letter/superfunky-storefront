import { parseLocalizedPrice, resolveVariationSwatchColor, type ProductCardData } from "@funky/ui";
import type { ProductReview, ProductVariationCombo, ProductVariationOption } from "../pages/shared";
import { graphqlRequest } from "./graphqlClient";
import { mapSeo, type CmsPageSeo, type CmsPageTranslation, type RawCmsSeo } from "./pages";

export const COMMERCE_SOURCE_LANGUAGE = "pl";

export type CommerceProductType = "simple" | "variable" | "external" | "grouped";
export type CommerceTaxonomy = "category" | "tag" | "brand";
export type CommerceTaxonomyIdentifierType = "URI" | "SLUG";

export type CmsProductCard = ProductCardData & {
  slug: string;
  uri: string;
  commerceProductType: CommerceProductType;
  stockStatus: string | null;
  stockQuantity: number | null;
  inStock: boolean | null;
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

type RawTerm = {
  id: string;
  databaseId: number;
  name: string | null;
  slug: string | null;
  uri: string | null;
  description?: string | null;
  count?: number | null;
  image?: RawImage | null;
};

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
  averageRating: number | null;
  reviewCount: number | null;
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
  sku: string | null;
  currencyPrices: string | null;
  language: { code: string | null } | null;
  translations: ({ databaseId: number; uri: string | null; language: { code: string | null } | null } | null)[] | null;
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
      rating: number | null;
      author: { node: { name: string | null } } | null;
    }[];
  } | null;
  seo: RawCmsSeo | null;
  buttonText?: string | null;
};

type CatalogResult = {
  products: { nodes: RawProductCard[]; pageInfo: { hasNextPage: boolean } } | null;
  productCategories: { nodes: RawTerm[] } | null;
  productTags: { nodes: RawTerm[] } | null;
  productBrands: { nodes: RawTerm[] } | null;
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

type ProductResult = { product: RawProductDetail | null };

type RawTaxonomySeo = Omit<RawCmsSeo, "schema"> & { schema: { raw: string | null } | null };

type ArchiveResult = {
  archive: (RawTerm & {
    products: { nodes: RawProductCard[]; pageInfo: { hasNextPage: boolean } } | null;
    seo: RawTaxonomySeo | null;
  }) | null;
  siblings: { nodes: RawTerm[] } | null;
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
  averageRating
  reviewCount
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

const PRODUCT_LIST_CARD_FIELDS = /* GraphQL */ `
  __typename
  id
  databaseId
  slug
  uri
  name
  shortDescription(format: RENDERED)
  averageRating
  reviewCount
  featured
  onSale
  image {
    id
    sourceUrl
    altText
    title
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

const TERM_FIELDS = /* GraphQL */ `
  id
  databaseId
  name
  slug
  uri
  description
  count
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
  opengraphSiteName
  opengraphTitle
  opengraphType
  opengraphUrl
  title
  twitterDescription
  twitterTitle
`;

const CATALOG_QUERY = /* GraphQL */ `
  query StorefrontCommerceCatalog($language: LanguageCodeFilterEnum!) {
    products(first: 24, where: { language: $language }) {
      nodes { ...StorefrontProductListCard }
      pageInfo { hasNextPage }
    }
    productCategories(first: 50, where: { hideEmpty: true }) {
      nodes {
        ${TERM_FIELDS}
        image { id sourceUrl altText title }
      }
    }
    productTags(first: 50, where: { hideEmpty: true }) {
      nodes { ${TERM_FIELDS} }
    }
    productBrands(first: 50, where: { hideEmpty: true }) {
      nodes {
        ${TERM_FIELDS}
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

const PRODUCT_DETAIL_QUERY = /* GraphQL */ `
  query StorefrontProductDetail($slug: ID!) {
    product(id: $slug, idType: SLUG) {
      ...StorefrontProductCard
      description(format: RENDERED)
      sku
      currencyPrices
      language { code }
      translations {
        databaseId
        uri
        language { code }
      }
      reviews(first: 30) {
        nodes {
          id
          databaseId
          content(format: RENDERED)
          date
          parentId
          rating
          author { node { name } }
        }
      }
      related(first: 12) { nodes { ...StorefrontProductCard } }
      upsell(first: 12) { nodes { ...StorefrontProductCard } }
      seo { ${SEO_FIELDS} }
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

const TAXONOMY_ARCHIVE_CONFIG: Record<CommerceTaxonomy, { field: string; idType: string; plural: string; hasImage: boolean }> = {
  category: { field: "productCategory", idType: "ProductCategoryIdType", plural: "productCategories", hasImage: true },
  tag: { field: "productTag", idType: "ProductTagIdType", plural: "productTags", hasImage: false },
  brand: { field: "productBrand", idType: "ProductBrandIdType", plural: "productBrands", hasImage: true },
};

function archiveQuery(taxonomy: CommerceTaxonomy): string {
  const { field, idType, plural, hasImage } = TAXONOMY_ARCHIVE_CONFIG[taxonomy];
  const image = hasImage ? "image { id sourceUrl altText title }" : "";

  return /* GraphQL */ `
    query StorefrontProductArchive($id: ID!, $idType: ${idType}!) {
      archive: ${field}(id: $id, idType: $idType) {
        ${TERM_FIELDS}
        ${image}
        products(first: 24) {
          nodes { ...StorefrontProductListCard }
          pageInfo { hasNextPage }
        }
        seo { ${TAXONOMY_SEO_FIELDS} }
      }
      siblings: ${plural}(first: 50, where: { hideEmpty: true }) {
        nodes {
          ${TERM_FIELDS}
          ${image}
        }
      }
    }
    ${PRODUCT_LIST_CARD_FRAGMENT}
  `;
}

export async function getCommerceCatalog(languageCode: string, backendLanguageCode: string): Promise<CmsCommerceCatalog> {
  const requestedLanguageCode = languageCode.trim().toLowerCase();
  const languageCodeUsed = requestedLanguageCode;
  const { data, errors } = await graphqlRequest<CatalogResult>(CATALOG_QUERY, {
    language: backendLanguageCode,
  });
  throwQueryErrors(errors, data);
  if (!data) throw new Error("The commerce catalog query returned no data");

  return {
    requestedLanguageCode,
    languageCode: languageCodeUsed,
    usesSourceLanguageFallback: false,
    products: data.products?.nodes.map(mapProductCard) || [],
    categories: mapCatalogTerms(data.products?.nodes, data.productCategories?.nodes),
    // The live ProductTags connection is currently empty. Preserve that real empty state.
    tags: mapTerms(data.productTags?.nodes),
    brands: mapCatalogTerms(
      data.products?.nodes,
      data.productBrands?.nodes,
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

/** Accepts either a WooCommerce product slug or a `/product/<slug>/` URI. */
export async function getProductByUriOrSlug(identifier: string): Promise<CmsProductDetail | null> {
  const slug = productSlugFromIdentifier(identifier);
  if (!slug) return null;
  const { data, errors } = await graphqlRequest<ProductResult>(PRODUCT_DETAIL_QUERY, { slug });
  throwQueryErrors(errors, data);
  if (!data) throw new Error("The product detail query returned no data");
  if (!data.product) return null;

  const product = data.product;
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
    shortDescriptionHtml: product.shortDescription || "",
    descriptionHtml: product.description || "",
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
        rating: normalizeRating(review.rating),
      })) || [],
    seo: mapSeo(product.seo),
    externalButtonText: product.buttonText?.trim() || null,
  });
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
): Promise<CmsProductArchive | null> {
  const { data, errors } = await graphqlRequest<ArchiveResult>(archiveQuery(taxonomy), {
    id: identifier,
    idType,
  });
  throwQueryErrors(errors, data);
  if (!data) throw new Error(`The product ${taxonomy} archive query returned no data`);
  if (!data.archive) return null;

  const archive = data.archive;
  return {
    taxonomy,
    id: archive.id,
    databaseId: archive.databaseId,
    name: archive.name?.trim() || TAXONOMY_FALLBACK_NAME[taxonomy],
    slug: archive.slug || "",
    uri: archive.uri || identifier,
    descriptionHtml: archive.description || "",
    count: archive.count || 0,
    imageUrl: archive.image?.sourceUrl || null,
    products: archive.products?.nodes.map(mapProductCard) || [],
    hasMoreProducts: archive.products?.pageInfo.hasNextPage || false,
    siblings: mapTerms(data.siblings?.nodes),
    seo: mapTaxonomySeo(archive.seo),
  };
}

export function getProductCategoryArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
): Promise<CmsProductArchive | null> {
  return getProductArchive("category", identifier, idType);
}

export function getProductTagArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
): Promise<CmsProductArchive | null> {
  return getProductArchive("tag", identifier, idType);
}

export function getProductBrandArchive(
  identifier: string,
  idType: CommerceTaxonomyIdentifierType = "URI",
): Promise<CmsProductArchive | null> {
  return getProductArchive("brand", identifier, idType);
}

export function mapProductCard(product: RawProductCard): CmsProductCard {
  const commerceProductType = mapProductType(product.__typename);
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

  return {
    id: product.id,
    databaseId: product.databaseId,
    href: product.uri || (product.slug ? `/product/${product.slug}/` : undefined),
    slug: product.slug || "",
    uri: product.uri || (product.slug ? `/product/${product.slug}/` : ""),
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
    rating: product.averageRating ?? undefined,
    reviewCount: product.reviewCount ?? undefined,
    badge: product.onSale ? "Sale" : undefined,
    isNew: false,
    productType:
      commerceProductType === "grouped"
        ? undefined
        : commerceProductType,
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

function mapProductType(typeName: string): CommerceProductType {
  if (typeName === "VariableProduct") return "variable";
  if (typeName === "ExternalProduct") return "external";
  if (typeName === "GroupProduct") return "grouped";
  return "simple";
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

function mapTerms(terms: RawTerm[] | undefined): CmsProductTerm[] {
  return dedupeBy(
    (terms || []).flatMap((term) =>
      term.name && term.slug && term.uri
        ? [{
            id: term.id,
            databaseId: term.databaseId,
            name: term.name,
            slug: term.slug,
            uri: term.uri,
            descriptionHtml: term.description || "",
            count: term.count || 0,
            imageUrl: term.image?.sourceUrl || null,
          }]
        : [],
    ),
    ({ id }) => id,
  );
}

function mapCatalogTerms(
  products: RawProductCard[] | undefined,
  listingTerms: RawTerm[] | undefined,
  termsOf: (product: RawProductCard) => RawTerm[] | undefined = (product) => product.productCategories?.nodes,
): CmsProductTerm[] {
  const listingById = new Map((listingTerms || []).map((term) => [term.id, term]));
  const assignedTerms = products?.flatMap((product) => termsOf(product) || []) || [];
  return mapTerms(
    dedupeBy(assignedTerms, ({ id }) => id).map((term) => ({
      ...term,
      ...listingById.get(term.id),
    })),
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
  if (!seo) return mapSeo(null);
  const { schema: _schema, ...common } = seo;
  return mapSeo({ ...common, schema: null });
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
