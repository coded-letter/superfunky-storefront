const ROUTE_IMAGE_FRAGMENT = `
  fragment StorefrontRouteImage on MediaItem {
    sourceUrl
    altText
    mimeType
    mediaDetails { width height }
  }
`;

const POST_TYPE_SEO_FRAGMENT = `
  fragment StorefrontPostTypeRouteSeo on PostTypeSEO {
    breadcrumbs { text url }
    canonical
    focuskw
    metaDesc
    metaKeywords
    metaRobotsNofollow
    metaRobotsNoindex
    opengraphAuthor
    opengraphDescription
    opengraphImage { ...StorefrontRouteImage }
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
    twitterImage { ...StorefrontRouteImage }
    twitterTitle
  }
`;

const TAXONOMY_SEO_FRAGMENT = `
  fragment StorefrontTaxonomyRouteSeo on TaxonomySEO {
    breadcrumbs { text url }
    canonical
    focuskw
    metaDesc
    metaKeywords
    metaRobotsNofollow
    metaRobotsNoindex
    opengraphAuthor
    opengraphDescription
    opengraphImage { ...StorefrontRouteImage }
    opengraphModifiedTime
    opengraphPublishedTime
    opengraphPublisher
    opengraphSiteName
    opengraphTitle
    opengraphType
    opengraphUrl
    title
    twitterDescription
    twitterImage { ...StorefrontRouteImage }
    twitterTitle
  }
`;

const USER_SEO_FIELDS = `
  seo {
    canonical
    metaDesc
    metaRobotsNofollow
    metaRobotsNoindex
    opengraphDescription
    opengraphImage { ...StorefrontRouteImage }
    opengraphTitle
    schema { articleType pageType }
    title
    twitterDescription
    twitterImage { ...StorefrontRouteImage }
    twitterTitle
  }
`;

export function buildRoutesQuery({
  commerce = false,
  multilingual = false,
  seo = false,
} = {}) {
  const productLanguageFragments = commerce && multilingual
    ? `
        ... on ExternalProduct { language { code } }
        ... on GroupProduct { language { code } }
        ... on SimpleProduct { language { code } }
        ... on VariableProduct { language { code } }
      `
    : "";
  const productFields = commerce
    ? `
        ... on Product {
          image { ...StorefrontRouteImage }
        }
        ${productLanguageFragments}
      `
    : "";
  const pageFields = `
        ... on Page {
          databaseId
          isFrontPage
          headlessContent
          ${multilingual ? "language { code }\n          translations { databaseId }" : ""}
        }
  `;
  const coreLanguageFields = multilingual
    ? `
        ... on CommunityPost { language { code } }
        ... on Post { language { code } }
      `
    : "";
  const taxonomySeoFields = seo
    ? `
        ... on Category { seo { ...StorefrontTaxonomyRouteSeo } }
        ... on Tag { seo { ...StorefrontTaxonomyRouteSeo } }
        ${commerce
    ? `
        ... on ProductBrand { seo { ...StorefrontTaxonomyRouteSeo } }
        ... on ProductCategory { seo { ...StorefrontTaxonomyRouteSeo } }
        ... on ProductTag { seo { ...StorefrontTaxonomyRouteSeo } }
      `
    : ""}
      `
    : "";
  const productTaxonomyFields = commerce
    ? `
        ... on ProductCategory {
          image { ...StorefrontRouteImage }
        }
      `
    : "";

  return `
    query StorefrontBuildRoutes($contentAfter: String, $termAfter: String, $userAfter: String) {
      readingSettings {
        showOnFront
        pageOnFront
      }
      contentNodes(first: 100, after: $contentAfter) {
        nodes {
          uri
          __typename
          ... on ContentNode {
            date
            modified
            ${seo ? "seo { ...StorefrontPostTypeRouteSeo }" : ""}
          }
          ... on NodeWithTitle {
            title
          }
          ... on NodeWithFeaturedImage {
            featuredImage { node { ...StorefrontRouteImage } }
          }
          ${productFields}
          ${pageFields}
          ${coreLanguageFields}
        }
        pageInfo { hasNextPage endCursor }
      }
      terms(first: 100, after: $termAfter) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoFields}
          ${productTaxonomyFields}
        }
        pageInfo { hasNextPage endCursor }
      }
      users(first: 100, after: $userAfter) {
        nodes {
          uri
          name
          ${seo ? USER_SEO_FIELDS : ""}
        }
        pageInfo { hasNextPage endCursor }
      }
    }
    ${ROUTE_IMAGE_FRAGMENT}
    ${seo ? `${POST_TYPE_SEO_FRAGMENT}\n${TAXONOMY_SEO_FRAGMENT}` : ""}
  `;
}

export function buildCoreRoutesQuery({
  connections = ["pages", "posts", "categories", "tags", "users"],
  multilingual = false,
  seo = false,
} = {}) {
  const selectedConnections = new Set(connections);
  const languageField = multilingual ? "language { code }" : "";
  const pageLanguageFields = multilingual
    ? "language { code }\n          translations { databaseId }"
    : "";
  const postSeoField = seo ? "seo { ...StorefrontPostTypeRouteSeo }" : "";
  const taxonomySeoField = seo ? "seo { ...StorefrontTaxonomyRouteSeo }" : "";

  return `
    query StorefrontCoreBuildRoutes(
      $pageAfter: String
      $postAfter: String
      $categoryAfter: String
      $tagAfter: String
      $userAfter: String
    ) {
      readingSettings {
        showOnFront
        pageOnFront
      }
      ${selectedConnections.has("pages") ? `pages(first: 100, after: $pageAfter) {
        nodes {
          uri
          __typename
          date
          modified
          title
          databaseId
          isFrontPage
          headlessContent
          ${pageLanguageFields}
          ${postSeoField}
          featuredImage { node { ...StorefrontRouteImage } }
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("posts") ? `posts(first: 100, after: $postAfter) {
        nodes {
          uri
          __typename
          date
          modified
          title
          ${languageField}
          ${postSeoField}
          featuredImage { node { ...StorefrontRouteImage } }
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("categories") ? `categories(first: 100, after: $categoryAfter) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoField}
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("tags") ? `tags(first: 100, after: $tagAfter) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoField}
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("users") ? `users(first: 100, after: $userAfter) {
        nodes {
          uri
          name
          ${seo ? USER_SEO_FIELDS : ""}
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
    }
    ${ROUTE_IMAGE_FRAGMENT}
    ${seo ? `${POST_TYPE_SEO_FRAGMENT}\n${TAXONOMY_SEO_FRAGMENT}` : ""}
  `;
}
