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

export function buildConfiguredFrontPageQuery({
  renderedContent = true,
  multilingual = false,
  publicRobots = false,
  specialPages = false,
  shopPages = false,
  translations = multilingual,
  seo = false,
} = {}) {
  const languageFields = multilingual
    ? "language { code }\n      translations { databaseId uri language { code } }"
    : translations ? "translations { databaseId uri }" : "";

  return `
    query StorefrontConfiguredFrontPage($databaseId: ID!) {
      page(id: $databaseId, idType: DATABASE_ID) {
        uri
        __typename
        date
        modified
        title
        id
        databaseId
        slug
        isFrontPage
        isPrivacyPage
        ${shopPages ? "isShopPage" : ""}
        ${specialPages ? "isTermsPage" : ""}
        ${renderedContent ? "content(format: RENDERED)\n        headlessContent" : ""}
        headlessShortcodes
        ${publicRobots ? "funkycommercePublicRobots { noindex nofollow }" : ""}
        ${languageFields}
        ${seo ? "seo { ...StorefrontPostTypeRouteSeo }" : ""}
        featuredImage { node { ...StorefrontRouteImage } }
      }
    }
    ${ROUTE_IMAGE_FRAGMENT}
    ${seo ? POST_TYPE_SEO_FRAGMENT : ""}
  `;
}

export function buildRoutesQuery({
  renderedContent = true,
  commerce = false,
  multilingual = false,
  publicRobots = false,
  specialPages = false,
  shopPages = false,
  translations = multilingual,
  seo = false,
} = {}) {
  const publicRobotsField = publicRobots
    ? "funkycommercePublicRobots { noindex nofollow }"
    : "";
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
          id
          databaseId
          slug
          isFrontPage
          isPrivacyPage
          ${shopPages ? "isShopPage" : ""}
          ${specialPages ? "isTermsPage" : ""}
          ${renderedContent ? "content(format: RENDERED)\n          headlessContent" : ""}
          headlessShortcodes
          ${multilingual
    ? "language { code }\n          translations { databaseId uri language { code } }"
    : translations ? "translations { databaseId uri }" : ""}
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
    query StorefrontBuildRoutes(
      $contentAfter: String, $termAfter: String, $userAfter: String,
      $skipContentNodes: Boolean! = false, $skipTerms: Boolean! = false, $skipUsers: Boolean! = false
    ) {
      readingSettings {
        showOnFront
        pageOnFront
      }
      contentNodes(first: ${renderedContent ? 25 : 100}, after: $contentAfter) @skip(if: $skipContentNodes) {
        nodes {
          uri
          __typename
          ... on ContentNode {
            date
            modified
            ${publicRobotsField}
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
      terms(first: 100, after: $termAfter) @skip(if: $skipTerms) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoFields}
          ${productTaxonomyFields}
        }
        pageInfo { hasNextPage endCursor }
      }
      users(first: 100, after: $userAfter) @skip(if: $skipUsers) {
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
  renderedContent = true,
  connections = ["pages", "posts", "categories", "tags", "users"],
  multilingual = false,
  publicRobots = false,
  specialPages = false,
  shopPages = false,
  translations = multilingual,
  seo = false,
} = {}) {
  const selectedConnections = new Set(connections);
  const cursorNames = { pages: "pageAfter", posts: "postAfter", categories: "categoryAfter", tags: "tagAfter", users: "userAfter" };
  const variables = [...selectedConnections].map((name) =>
    `$${cursorNames[name]}: String, $skip${name[0].toUpperCase()}${name.slice(1)}: Boolean! = false`).join("\n");
  const languageField = multilingual ? "language { code }" : "";
  const pageLanguageFields = multilingual
    ? "language { code }\n          translations { databaseId uri }"
    : translations ? "translations { databaseId uri }" : "";
  const postSeoField = seo ? "seo { ...StorefrontPostTypeRouteSeo }" : "";
  const publicRobotsField = publicRobots
    ? "funkycommercePublicRobots { noindex nofollow }"
    : "";
  const taxonomySeoField = seo ? "seo { ...StorefrontTaxonomyRouteSeo }" : "";

  return `
    query StorefrontCoreBuildRoutes(
      ${variables}
    ) {
      readingSettings {
        showOnFront
        pageOnFront
      }
      ${selectedConnections.has("pages") ? `pages(first: ${renderedContent ? 25 : 100}, after: $pageAfter) @skip(if: $skipPages) {
        nodes {
          uri
          __typename
          date
          modified
          title
          id
          databaseId
          slug
          isFrontPage
          isPrivacyPage
          ${shopPages ? "isShopPage" : ""}
          ${specialPages ? "isTermsPage" : ""}
          ${renderedContent ? "content(format: RENDERED)\n          headlessContent" : ""}
          headlessShortcodes
          ${publicRobotsField}
          ${multilingual
    ? "language { code }\n          translations { databaseId uri language { code } }"
    : pageLanguageFields}
          ${postSeoField}
          featuredImage { node { ...StorefrontRouteImage } }
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("posts") ? `posts(first: 100, after: $postAfter) @skip(if: $skipPosts) {
        nodes {
          uri
          __typename
          date
          modified
          title
          ${publicRobotsField}
          ${languageField}
          ${postSeoField}
          featuredImage { node { ...StorefrontRouteImage } }
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("categories") ? `categories(first: 100, after: $categoryAfter) @skip(if: $skipCategories) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoField}
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("tags") ? `tags(first: 100, after: $tagAfter) @skip(if: $skipTags) {
        nodes {
          uri
          __typename
          name
          ${taxonomySeoField}
        }
        pageInfo { hasNextPage endCursor }
      }` : ""}
      ${selectedConnections.has("users") ? `users(first: 100, after: $userAfter) @skip(if: $skipUsers) {
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
