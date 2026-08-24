import { normalizeDisplayLabel } from "@funky/ui/src/seo/htmlEntities.ts";
import { parseLocalizedPrice } from "@funky/ui/src/locale/pricing.ts";
import type {
  PostCardData,
  ProductCardData,
  SocialPostCardData,
  SocialPostMedia,
} from "@funky/ui";
import type { ProductReview } from "../pages/shared";
import { authStore } from "./auth.ts";
import { graphqlRequest, type GraphqlResponse } from "@funky/sdk";
import { filterTranslationCandidates } from "./translationCandidates.ts";
import { communityHandleFromUser, isCommunityArchiveAuthor } from "./communityProfiles.ts";
import { resolveCommerceProductType } from "@funky/commerce";
import { mapPublicEngagementRating, type PublicEngagementRatingSummary } from "./engagementRatings.ts";
import {
  removeGraphqlFieldSelections,
  removeNestedGraphqlFieldSelections,
} from "./graphqlFieldFallback.ts";

export type CommunityMember = {
  databaseId: number;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  role: "member" | "creator" | "collaborator";
  memberTypes: Array<"member" | "customer" | "subscriber" | "admin" | "creator" | "collaborator">;
  isPublic: boolean;
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
  coverUrl?: string;
  relationshipState: CommunityRelationshipState;
  canAccess: boolean;
  isLocked: boolean;
};

export type CommunityRelationshipState = "none" | "pending" | "accepted" | "owner";

export type CommunityProfileConnection = {
  nodes: CommunityMember[];
  totalCount: number;
  hasNextPage: boolean;
  endCursor: string | null;
};

export type CommunityProfileData = {
  member: CommunityMember;
  followers: CommunityProfileConnection;
  following: CommunityProfileConnection;
  pendingRequests: CommunityProfileConnection;
  posts: CommunityPostData[];
  followingFeed: CommunityPostData[];
  products: ProductCardData[];
  articles: PostCardData[];
};

export type CommunityPostData = SocialPostCardData & {
  databaseId: number;
  languageCode: string;
  title: string;
  description: string;
  media: SocialPostMedia[];
  canEdit: boolean;
  canDelete: boolean;
  likedByViewer?: boolean;
  tagSlugs: string[];
  ratingAverage?: number;
  engagementRating: PublicEngagementRatingSummary;
  reviews: ProductReview[];
  contentHtml: string;
};

export function filterCommunityPostsByLanguage<T extends { languageCode: string }>(
  posts: readonly T[],
  languageCode: string,
): T[] {
  const normalizedLanguageCode = languageCode.toLowerCase();
  // Posts with an empty languageCode come from backends without Polylang support;
  // they are language-agnostic so we include them regardless of the active locale.
  return posts.filter((post) => !post.languageCode || post.languageCode.toLowerCase() === normalizedLanguageCode);
}

// Same rule as filterCommunityPostsByLanguage, applied to raw (pre-mapping) GraphQL
// nodes that carry a nested `language { code }` field instead of a flattened
// `languageCode` string (e.g. a profile's marketplace products/blog articles).
function filterRawNodesByLanguage<T extends { language?: { code?: string | null } | null }>(
  nodes: readonly T[],
  languageCode: string,
): T[] {
  const normalizedLanguageCode = languageCode.toLowerCase();
  return nodes.filter((node) => {
    const code = node.language?.code;
    return !code || code.toLowerCase() === normalizedLanguageCode;
  });
}

export type CommunityTagSummary = {
  name: string;
  slug: string;
  postCount: number;
};

export type CommunityArchiveData = {
  authors: CommunityMember[];
  tags: CommunityTagSummary[];
  posts: CommunityPostData[];
};

export type CommunityPostDetail = {
  post: CommunityPostData;
  author: CommunityMember;
  languageCode: string;
  uri: string;
  translations: { databaseId: number; languageCode: string; uri: string }[];
};

export type CommunityPostEditorMedia = {
  attachmentId: number;
  url: string;
  mimeType: string;
  mediaType: "image" | "video";
};

/** Preserve the backend's complete ordered media contract when opening the editor. */
export function communityPostMediaForEditor(media: readonly SocialPostMedia[]): CommunityPostEditorMedia[] {
  return media.map((item) => ({
    attachmentId: item.databaseId,
    url: item.url,
    mimeType: item.mimeType,
    mediaType: item.mediaType,
  }));
}

/** SEO fields mirrored from the site's Yoast-shaped `seo` query field (see `Seo.tsx`). */
export type SeoFieldsInput = {
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
};

export type DownloadableFileInput = { name: string; fileDataUrl: string };
export type MarketplaceProductType = "simple" | "variable" | "external";

/** A candidate post/product for the "this is a translation of…" association UI. */
export type TranslationCandidate = {
  databaseId: number;
  title: string;
  languageCode: string;
  uri: string;
};

export type CollaboratorPostForEditing = {
  databaseId: number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  languageCode: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  translationOfId?: number;
};

export type MarketplaceProductForEditing = {
  databaseId: number;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  brand: string;
  upsellIds: number[];
  crossSellIds: number[];
  productType: MarketplaceProductType;
  sku: string;
  stockQuantity: number;
  priceLabel: string;
  compareAtPriceLabel: string;
  imageUrls: string[];
  isVirtual: boolean;
  isDownloadable: boolean;
  downloadLimit: number;
  downloadExpiryDays: number;
  existingDownloadNames: string[];
  externalUrl: string;
  buttonText: string;
  attributes: { name: string; options: string[] }[];
  variations: {
    databaseId: number;
    attributes: { name: string; option: string }[];
    sku: string;
    priceLabel: string;
    compareAtPriceLabel: string;
    stockQuantity: number;
    isVirtual: boolean;
    isDownloadable: boolean;
    downloadLimit: number;
    downloadExpiryDays: number;
    existingDownloadNames: string[];
  }[];
};

export type MarketplaceItem = {
  product: ProductCardData;
  vendor: CommunityMember;
};

export type CommunityViewer = CommunityMember & {
  capabilities: string[];
};

export type CommunityData = {
  posts: CommunityPostData[];
  members: CommunityMember[];
  marketplaceItems: MarketplaceItem[];
  profilesPublicEnabled: boolean;
  followersEnabled: boolean;
};

type RawUser = {
  databaseId: number;
  name: string | null;
  nicename?: string | null;
  communityHandle: string | null;
  description: string | null;
  avatar: { url: string | null } | null;
  communityRole: string | null;
  communityMemberTypes?: string[] | null;
  communityProfilePublic: boolean | null;
  followerCount?: number | null;
  followingCount?: number | null;
  isFollowedByViewer?: boolean | null;
  cover?: { url: string | null } | null;
  communityCover?: { url: string | null } | null;
  relationshipState?: string | null;
  canAccess?: boolean | null;
  isLocked?: boolean | null;
};

type RawCommunityProfileConnection = {
  nodes: RawUser[];
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type RawComment = {
  id: string;
  databaseId: number;
  content: string | null;
  date: string | null;
  parentId: string | null;
  parentDatabaseId: number | null;
  rating: number | null;
  author?: { node: { name: string | null } | null } | null;
};

type RawCommunityPost = {
  id: string;
  databaseId: number;
  uri: string | null;
  title: string | null;
  description: string | null;
  content: string | null;
  date: string | null;
  likesCount: number;
  commentCount?: number | null;
  likedByViewer: boolean;
  engagementRating: PublicEngagementRatingSummary;
  canEdit?: boolean;
  canDelete?: boolean;
  media: {
    databaseId: number;
    url: string;
    mimeType: string;
    mediaType: string;
    altText: string;
    width: number | null;
    height: number | null;
    srcSet: string | null;
    sizes: string | null;
  }[];
  featuredImage: {
    node: {
      sourceUrl: string | null;
      srcSet: string | null;
      mediaDetails: { width: number | null; height: number | null } | null;
    };
  } | null;
  communityTags: { nodes: { name: string | null; slug: string | null }[] };
  language?: { code: string | null } | null;
  author: { node: RawUser | null } | null;
  comments?: {
    nodes: RawComment[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
};

type RawCommunityPostDetail = RawCommunityPost & {
  __typename: "CommunityPost";
  language: { code: string | null } | null;
  translations?: { databaseId: number; uri: string | null; language: { code: string | null } | null }[] | null;
  comments: NonNullable<RawCommunityPost["comments"]>;
};

type RawProduct = {
  __typename: string;
  id: string;
  databaseId: number;
  name: string | null;
  slug: string | null;
  uri: string | null;
  shortDescription: string | null;
  image: { sourceUrl: string | null } | null;
  productBrands: { nodes: { name: string | null; uri: string | null }[] };
  seller: RawUser | null;
  language?: { code?: string | null } | null;
  engagementRating: PublicEngagementRatingSummary;
  price?: string | null;
  regularPrice?: string | null;
  salePrice?: string | null;
  externalUrl?: string | null;
  variations?: {
    nodes: {
      id: string;
      databaseId: number;
      price: string | null;
      regularPrice: string | null;
      salePrice: string | null;
      stockStatus: string | null;
      image: { sourceUrl: string | null } | null;
      attributes: { nodes: { name: string | null; label: string | null; value: string | null }[] } | null;
    }[];
  } | null;
};

type CommunityQueryResult = {
  communityPosts: {
    nodes: RawCommunityPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  marketplaceProducts: (RawProduct | null)[] | null;
  viewerMarketplaceProducts?: (RawProduct | null)[] | null;
};

type CommunityFeedQueryResult = {
  communityPosts: {
    nodes: RawCommunityPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  communityProfilesPublicEnabled?: boolean;
  communityFollowersEnabled?: boolean;
};

type CommunityFeedPageQueryResult = {
  communityPosts: {
    nodes: RawCommunityPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  } | null;
};

type CommunityArchivePostsResult = {
  communityPosts: {
    nodes: RawCommunityPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  } | null;
};

type RawProfileArticle = {
  id: string;
  databaseId: number;
  slug: string | null;
  uri: string | null;
  title: string | null;
  excerpt: string | null;
  date: string | null;
  modified: string | null;
  featuredImage: { node: { sourceUrl: string | null } | null } | null;
  language?: { code?: string | null } | null;
};

type RawCommunityProfile = RawUser & {
  followers: RawCommunityProfileConnection;
  following: RawCommunityProfileConnection;
  posts: RawCommunityPost[];
  followingFeed: RawCommunityPost[];
  products?: RawProduct[];
  articles: RawProfileArticle[];
};

const COMMUNITY_QUERY = /* GraphQL */ `
  query StorefrontCommunity($languageSlug: String, $viewerSellerId: Int, $hasViewer: Boolean!) {
    communityPosts(first: 100) {
      nodes {
        id
        databaseId
        uri
        title(format: RENDERED)
        description
        content(format: RENDERED)
        date
        likesCount
        likedByViewer
        engagementRating {
          average
          count
          guestCount
          authoredCount
          histogram
        }
        canEdit
        canDelete
        language: funkycommerceLanguage { code }
        media {
          databaseId
          url
          mimeType
          mediaType
          altText
          width
          height
          srcSet
          sizes
        }
        featuredImage {
          node {
            sourceUrl(size: LARGE)
            srcSet(size: LARGE)
            mediaDetails {
              width
              height
            }
          }
        }
        communityTags {
          nodes {
            name
            slug
          }
        }
        author {
          node {
            databaseId
            name
            communityHandle
            description
            avatar(size: 192) {
              url
            }
            communityCover { url }
            communityRole
            communityProfilePublic
          }
        }
        comments(first: 100, where: { statusIn: [APPROVE] }) {
          nodes {
            id
            databaseId
            content(format: RENDERED)
            date
            parentId
            parentDatabaseId
            rating
            author {
              node {
                name
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
    marketplaceProducts(first: 48, language: $languageSlug) {
      __typename
      id
      databaseId
      name
      slug
      uri
      shortDescription(format: RENDERED)
      image {
        sourceUrl(size: MEDIUM_LARGE)
      }
      productBrands {
        nodes {
          name
          uri
        }
      }
      seller {
        databaseId
        name
        communityHandle
        description
        avatar(size: 192) {
          url
        }
        communityRole
        communityProfilePublic
      }
      engagementRating {
        average
        count
        guestCount
        authoredCount
        histogram
      }
      ... on SimpleProduct {
        price
        regularPrice
        salePrice
      }
      ... on VariableProduct {
        price
        regularPrice
        salePrice
        variations(first: 50) {
          nodes {
            id
            databaseId
            price
            regularPrice
            salePrice
            stockStatus
            image {
              sourceUrl(size: MEDIUM_LARGE)
            }
            attributes {
              nodes {
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
    }
    viewerMarketplaceProducts: marketplaceProducts(first: 48, language: $languageSlug, sellerId: $viewerSellerId) @include(if: $hasViewer) {
      __typename
      id
      databaseId
      name
      slug
      uri
      shortDescription(format: RENDERED)
      image {
        sourceUrl(size: MEDIUM_LARGE)
      }
      productBrands {
        nodes {
          name
          uri
        }
      }
      seller {
        databaseId
        name
        communityHandle
        description
        avatar(size: 192) {
          url
        }
        communityRole
        communityProfilePublic
      }
      engagementRating {
        average
        count
        guestCount
        authoredCount
        histogram
      }
      ... on SimpleProduct {
        price
        regularPrice
        salePrice
      }
      ... on VariableProduct {
        price
        regularPrice
        salePrice
        variations(first: 50) {
          nodes {
            id
            databaseId
            price
            regularPrice
            salePrice
            stockStatus
            image {
              sourceUrl(size: MEDIUM_LARGE)
            }
            attributes {
              nodes {
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
    }
  }
`;

const COMMUNITY_FEED_POST_FIELDS = /* GraphQL */ `
  fragment StorefrontCommunityFeedPostFields on CommunityPost {
    id
    databaseId
    uri
    title(format: RENDERED)
    description
    date
    likesCount
    commentCount
    language: funkycommerceLanguage { code }
    engagementRating {
      average
      count
      guestCount
      authoredCount
      histogram
    }
    media {
      databaseId
      url
      mimeType
      mediaType
      altText
      width
      height
      srcSet
      sizes
    }
    featuredImage {
      node {
        sourceUrl(size: LARGE)
        srcSet(size: LARGE)
        mediaDetails {
          width
          height
        }
      }
    }
    communityTags {
      nodes {
        name
        slug
      }
    }
    author {
      node {
        databaseId
        name
        communityHandle
        description
        avatar(size: 192) {
          url
        }
        communityCover { url }
        communityRole
        communityProfilePublic
      }
    }
  }
`;

const COMMUNITY_FEED_QUERY = /* GraphQL */ `
  query StorefrontCommunityFeed {
    communityPosts(first: 100) {
      nodes { ...StorefrontCommunityFeedPostFields }
      pageInfo { hasNextPage endCursor }
    }
    communityProfilesPublicEnabled
    communityFollowersEnabled
  }
  ${COMMUNITY_FEED_POST_FIELDS}
`;

const COMMUNITY_FEED_PAGE_QUERY = /* GraphQL */ `
  query StorefrontCommunityFeedPage($after: String) {
    communityPosts(first: 100, after: $after) {
      nodes { ...StorefrontCommunityFeedPostFields }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${COMMUNITY_FEED_POST_FIELDS}
`;

const COMMUNITY_POST_FIELDS = /* GraphQL */ `
  fragment StorefrontCommunityPostFields on CommunityPost {
    id
    databaseId
    uri
    title(format: RENDERED)
    description
    content(format: RENDERED)
    date
    likesCount
    likedByViewer
    engagementRating {
      average
      count
      guestCount
      authoredCount
      histogram
    }
    canEdit
    canDelete
    media {
      databaseId
      url
      mimeType
      mediaType
      altText
      width
      height
      srcSet
      sizes
    }
    language: funkycommerceLanguage {
      code
    }
    translations: funkycommerceTranslations {
      databaseId
      uri
      language: funkycommerceLanguage {
        code
      }
    }
    featuredImage {
      node {
        sourceUrl(size: LARGE)
        srcSet(size: LARGE)
        mediaDetails {
          width
          height
        }
      }
    }
    communityTags {
      nodes {
        name
        slug
      }
    }
    author {
      node {
        databaseId
        name
        communityHandle
        description
        avatar(size: 192) {
          url
        }
        communityRole
        communityProfilePublic
      }
    }
    comments(first: 100, where: { statusIn: [APPROVE] }) {
      nodes {
        id
        databaseId
        content(format: RENDERED)
        date
        parentId
        parentDatabaseId
        rating
        author {
          node {
            name
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COMMUNITY_PROFILE_MEMBER_FIELDS = /* GraphQL */ `
  fragment StorefrontCommunityProfileMemberFields on CommunityMemberProfile {
    databaseId
    name
    nicename
    communityHandle
    description
    avatar(size: 192) { url }
    cover { url }
    communityRole
    communityProfilePublic
    followerCount
    followingCount
    isFollowedByViewer
    relationshipState
    canAccess
    isLocked
  }
`;

const COMMUNITY_PROFILE_QUERY = /* GraphQL */ `
  query StorefrontCommunityProfile(
    $handle: String!
    $languageSlug: String!
    $connectionFirst: Int!
    $followersAfter: String
    $followingAfter: String
  ) {
    communityProfileByHandle(handle: $handle) {
      ...StorefrontCommunityProfileMemberFields
      followers(first: $connectionFirst, after: $followersAfter) {
        nodes { ...StorefrontCommunityProfileMemberFields }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
      following(first: $connectionFirst, after: $followingAfter) {
        nodes { ...StorefrontCommunityProfileMemberFields }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
      posts(language: $languageSlug) { ...StorefrontCommunityPostFields }
      followingFeed(language: $languageSlug) { ...StorefrontCommunityPostFields }
      products(language: $languageSlug) {
        __typename
        id
        databaseId
        name
        slug
        uri
        shortDescription(format: RENDERED)
        image { sourceUrl(size: MEDIUM_LARGE) }
        productBrands { nodes { name uri } }
        language { code }
        engagementRating {
          average
          count
          guestCount
          authoredCount
          histogram
        }
        ... on SimpleProduct { price regularPrice salePrice }
        ... on VariableProduct { price regularPrice salePrice }
        ... on ExternalProduct { price regularPrice salePrice externalUrl }
        ... on GroupProduct { price regularPrice salePrice }
      }
      articles(language: $languageSlug) {
        id
        databaseId
        slug
        uri
        title(format: RENDERED)
        excerpt(format: RENDERED)
        date
        modified
        featuredImage { node { sourceUrl(size: MEDIUM_LARGE) } }
        language { code }
      }
    }
  }
  ${COMMUNITY_PROFILE_MEMBER_FIELDS}
  ${COMMUNITY_POST_FIELDS}
`;

const COMMUNITY_PROFILE_MEMBER_QUERY = /* GraphQL */ `
  query StorefrontCommunityProfileMember($handle: String!) {
    communityProfileByHandle(handle: $handle) {
      ...StorefrontCommunityProfileMemberFields
    }
  }
  ${COMMUNITY_PROFILE_MEMBER_FIELDS}
`;

const COMMUNITY_ARCHIVE_POSTS_QUERY = /* GraphQL */ `
  query StorefrontCommunityArchivePosts($after: String) {
    communityPosts(first: 100, after: $after) {
      nodes {
        ...StorefrontCommunityPostFields
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${COMMUNITY_POST_FIELDS}
`;

const COMMUNITY_POST_QUERY = /* GraphQL */ `
  query StorefrontCommunityPost($id: ID!) {
    contentNode(id: $id, idType: DATABASE_ID) {
      __typename
      ...StorefrontCommunityPostFields
    }
  }
  ${COMMUNITY_POST_FIELDS}
`;

const COMMUNITY_POST_BY_SLUG_QUERY = /* GraphQL */ `
  query StorefrontCommunityPostBySlug($slug: ID!) {
    communityPost(id: $slug, idType: SLUG) {
      __typename
      ...StorefrontCommunityPostFields
    }
  }
  ${COMMUNITY_POST_FIELDS}
`;

const COMMUNITY_POST_COMMENTS_QUERY = /* GraphQL */ `
  query StorefrontCommunityPostComments($id: ID!, $after: String) {
    contentNode(id: $id, idType: DATABASE_ID) {
      __typename
      ... on CommunityPost {
        comments(first: 100, after: $after, where: { statusIn: [APPROVE] }) {
          nodes {
            id
            databaseId
            content(format: RENDERED)
            date
            parentId
            parentDatabaseId
            rating
            author {
              node {
                name
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

export function withoutCommunityLocalizationFields(query: string): string {
  const withoutLocalizationArguments = query
    .replace(/\(\s*\$language:\s*LanguageCodeFilterEnum\s*\)/g, "")
    .replace(/\$language:\s*LanguageCodeFilterEnum,\s*/g, "")
    .replace(/\n\s*\$language:\s*LanguageCodeFilterEnum,?\s*/g, "\n")
    .replace(/,\s*\$languageSlug:\s*String!?/g, "")
    .replace(/\(\s*\$languageSlug:\s*String!?\s*,?/g, "(")
    .replace(/\n\s*\$languageSlug:\s*String!?,?\s*/g, "\n")
    .replace(/\(\s*language:\s*\$languageSlug\s*\)/g, "")
    .replace(/\(\s*language:\s*\$languageSlug\s*,\s*/g, "(")
    .replace(/,\s*language:\s*\$languageSlug/g, "")
    .replace(/,\s*where:\s*\{\s*status:\s*PUBLISH,\s*language:\s*\$language\s*\}/g, "")
    .replace(/,\s*where:\s*\{\s*language:\s*\$language\s*\}/g, "");
  return removeGraphqlFieldSelections(
    removeGraphqlFieldSelections(withoutLocalizationArguments, "translations"),
    "language",
  );
}

async function communityGraphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GraphqlResponse<T>> {
  let compatibleQuery = query;
  let response = await graphqlRequest<T>(compatibleQuery, variables, token);
  const responsiveMediaFieldsUnavailable = response.errors?.some(({ message }) =>
    /Cannot query field "(?:srcSet|sizes)" on type "FunkycommerceCommunityMedia"/.test(message)
  );
  if (responsiveMediaFieldsUnavailable) {
    compatibleQuery = removeGraphqlFieldSelections(
      removeGraphqlFieldSelections(compatibleQuery, "srcSet"),
      "sizes",
    );
    response = await graphqlRequest<T>(compatibleQuery, variables, token);
  }
  const commentAuthorUnavailable = response.errors?.some(({ message }) =>
    message === "Internal server error" && compatibleQuery.includes("comments(")
  );
  if (commentAuthorUnavailable) {
    compatibleQuery = removeNestedGraphqlFieldSelections(compatibleQuery, "comments", "author");
    response = await graphqlRequest<T>(compatibleQuery, variables, token);
  }
  const translationsFieldUnavailable = response.errors?.some(({ message }) =>
    /Cannot query field "funkycommerceTranslations" on type/.test(message)
  );
  if (translationsFieldUnavailable) {
    compatibleQuery = removeGraphqlFieldSelections(compatibleQuery, "translations");
    response = await graphqlRequest<T>(compatibleQuery, variables, token);
  }
  const hasOptionalLocalization = compatibleQuery.includes("LanguageCodeFilterEnum")
    || compatibleQuery.includes("$languageSlug")
    || compatibleQuery.includes("language {")
    || compatibleQuery.includes("translations {")
    || compatibleQuery.includes("funkycommerceLanguage")
    || compatibleQuery.includes("funkycommerceTranslations");
  const localizationFieldsUnavailable = response.errors?.some(({ message }) => (
    [
      'Unknown type "LanguageCodeFilterEnum"',
      'Field "language" is not defined by type "RootQueryToCommunityPostConnectionWhereArgs"',
    ].some((schemaError) => message.includes(schemaError))
    // Match "Cannot query field \"language\"/\"translations\" on type ..." for any GraphQL
    // type, not just CommunityPost — the community profile query also requests these
    // fields on products/articles, which fail with a type-specific message on backends
    // without Polylang support for those content types.
    || /Cannot query field "(?:language|translations)" on type/.test(message)
    || /Cannot query field "(?:funkycommerceLanguage|funkycommerceTranslations)" on type/.test(message)
    || /Unknown argument "language" on field/.test(message)
    || (hasOptionalLocalization && message === "Internal server error")
  ));
  if (!localizationFieldsUnavailable) return response;
  return graphqlRequest<T>(withoutCommunityLocalizationFields(compatibleQuery), variables, token);
}

async function loadRemainingCommunityPosts(
  initial: {
    nodes: RawCommunityPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  },
  token?: string,
): Promise<RawCommunityPost[]> {
  const posts = [...initial.nodes];
  let pageInfo = initial.pageInfo;
  const seenCursors = new Set<string>();

  while (pageInfo.hasNextPage) {
    const after = pageInfo.endCursor;
    if (!after || seenCursors.has(after)) {
      throw new Error("The community post query returned an incomplete pagination cursor");
    }
    seenCursors.add(after);
    const response = await communityGraphqlRequest<CommunityArchivePostsResult>(
      COMMUNITY_ARCHIVE_POSTS_QUERY,
      { after },
      token,
    );
    if (response.errors?.length) {
      throw new Error(response.errors.map(({ message }) => message).join("; "));
    }
    const connection = response.data?.communityPosts;
    if (!connection) throw new Error("The paginated community post query returned no data");
    posts.push(...connection.nodes);
    pageInfo = connection.pageInfo;
  }

  return posts;
}

async function loadCommunityFeedPosts(
  initial: CommunityFeedQueryResult["communityPosts"],
  languageCode: string,
): Promise<RawCommunityPost[]> {
  const posts = [...initial.nodes];
  let pageInfo = initial.pageInfo;
  const seenCursors = new Set<string>();

  while (pageInfo.hasNextPage && filterRawNodesByLanguage(posts, languageCode).length < 12) {
    const after = pageInfo.endCursor;
    if (!after || seenCursors.has(after)) {
      throw new Error("The community feed query returned an incomplete pagination cursor");
    }
    seenCursors.add(after);
    const response = await communityGraphqlRequest<CommunityFeedPageQueryResult>(
      COMMUNITY_FEED_PAGE_QUERY,
      { after },
    );
    if (response.errors?.length) {
      throw new Error(response.errors.map(({ message }) => message).join("; "));
    }
    const connection = response.data?.communityPosts;
    if (!connection) throw new Error("The paginated community feed query returned no data");
    posts.push(...connection.nodes);
    pageInfo = connection.pageInfo;
  }

  return posts;
}

export async function getCommunityData(languageCode: string, backendLanguageCode: string): Promise<CommunityData> {
  const auth = authStore.load();
  const [communityResponse, rawMembers, profilesPublicEnabled, followersEnabled] = await Promise.all([
    communityGraphqlRequest<CommunityQueryResult>(
      COMMUNITY_QUERY,
      {
        languageSlug: languageCode.toLowerCase(),
        viewerSellerId: auth?.user?.databaseId || null,
        hasViewer: Boolean(auth?.user?.databaseId),
      },
      auth?.authToken,
    ),
    getCommunityMembers(auth?.authToken),
    getCommunityFeatureFlag("communityProfilesPublicEnabled", auth?.authToken),
    getCommunityFeatureFlag("communityFollowersEnabled", auth?.authToken),
  ]);
  const { data, errors } = communityResponse;
  if (errors?.length) {
    try {
      const community = await getCommunityFeedData(languageCode, backendLanguageCode);
      const members = new Map(
        [...rawMembers.map(mapMember), ...community.members].map((member) => [member.databaseId, member]),
      );
      return {
        ...community,
        members: Array.from(members.values()),
        profilesPublicEnabled,
        followersEnabled,
      };
    } catch (fallbackError) {
      throw new Error(
        `${errors.map(({ message }) => message).join("; ")}; ${
          fallbackError instanceof Error ? fallbackError.message : "The compatible community feed also failed"
        }`,
      );
    }
  }

  if (!data) throw new Error("The community query returned no data");
  const rawCommunityPosts = await loadRemainingCommunityPosts(data.communityPosts, auth?.authToken);

  const members = rawMembers.map(mapMember);
  const membersById = new Map(members.map((member) => [member.databaseId, member]));
  const includePublicAuthor = (user: RawUser): CommunityMember => {
    const existing = membersById.get(user.databaseId);
    if (existing) return existing;
    const member = mapMember(user);
    if (member.isPublic || member.databaseId === auth?.user?.databaseId) {
      members.push(member);
      membersById.set(member.databaseId, member);
    }
    return member;
  };
  const posts = filterCommunityPostsByLanguage(rawCommunityPosts.flatMap((post) => {
    const author = post.author?.node;
    if (!author) return [];
    const member = includePublicAuthor(author);
    return [mapCommunityPost(post, member)];
  }), backendLanguageCode);

  const seenProductIds = new Set<string>();
  const marketplaceItems = [...(data.viewerMarketplaceProducts || []), ...(data.marketplaceProducts || [])].flatMap((product) => {
    if (!product) return [];
    if (seenProductIds.has(product.id)) return [];
    seenProductIds.add(product.id);
    const owner = product.seller;
    if (!owner) return [];
    const vendor = includePublicAuthor(owner);
    const brand = product.productBrands.nodes.find(({ name }) => name);
    const variations = (product.variations?.nodes || []).flatMap((variation) => {
      const priceAmount = parseLocalizedPrice(variation.price || variation.salePrice || variation.regularPrice || "");
      if (priceAmount === null) return [];
      const regularPriceAmount = parseLocalizedPrice(variation.regularPrice || "");
      return [{
        id: variation.id,
        databaseId: variation.databaseId,
        attributes: Object.fromEntries(
          (variation.attributes?.nodes || []).flatMap(({ name, label, value }) => {
            const attributeName = label || name;
            return attributeName && value ? [[attributeName, value]] : [];
          }),
        ),
        priceLabel: variation.price || "",
        priceAmount,
        compareAtPriceLabel: variation.salePrice ? variation.regularPrice || undefined : undefined,
        compareAtPriceAmount: variation.salePrice && regularPriceAmount !== null ? regularPriceAmount : undefined,
        imageUrl: variation.image?.sourceUrl || undefined,
        inStock: variation.stockStatus !== "OUT_OF_STOCK",
      }];
    });
    const variationOptions = Array.from(
      variations.reduce((options, variation) => {
        Object.entries(variation.attributes).forEach(([label, value]) => {
          const values = options.get(label) || new Set<string>();
          values.add(value);
          options.set(label, values);
        });
        return options;
      }, new Map<string, Set<string>>()),
      ([label, values]) => ({ label, values: Array.from(values, (value) => ({ label: value })) }),
    );
    const variablePriceAmounts = variations.map(({ priceAmount }) => priceAmount).filter((amount): amount is number => amount !== undefined);
    const fallbackPriceAmount = parseLocalizedPrice(product.price || product.salePrice || product.regularPrice || "") ?? undefined;
    const engagementRating = mapPublicEngagementRating(product.engagementRating);
    return [{
      vendor,
      product: {
        id: product.id,
        databaseId: product.databaseId,
        name: product.name || "Untitled listing",
        subtitle: stripHtml(product.shortDescription || "") || undefined,
        category: "Marketplace",
        priceLabel: product.price || "",
        priceAmount: variablePriceAmounts.length ? Math.min(...variablePriceAmounts) : fallbackPriceAmount,
        compareAtPriceLabel: product.salePrice ? product.regularPrice || undefined : undefined,
        compareAtPriceAmount: product.salePrice ? parseLocalizedPrice(product.regularPrice || "") ?? undefined : undefined,
        rating: engagementRating.average ?? undefined,
        reviewCount: engagementRating.count,
        imageUrl: product.image?.sourceUrl || undefined,
        brand: brand?.name || undefined,
        brandHref: brand?.uri || undefined,
        href: product.uri || (product.slug ? `/shop/${product.slug}` : "/shop"),
        productType: resolveCommerceProductType(product.__typename),
        externalUrl: product.__typename === "ExternalProduct" ? product.externalUrl || undefined : undefined,
        variations: variations.length ? variations : undefined,
        variationOptions: variationOptions.length ? variationOptions : undefined,
      },
    }];
  });

  return { posts, members, marketplaceItems, profilesPublicEnabled, followersEnabled };
}

export async function getCommunityFeedData(
  languageCode: string,
  backendLanguageCode: string,
): Promise<CommunityData> {
  const { data, errors } = await communityGraphqlRequest<CommunityFeedQueryResult>(
    COMMUNITY_FEED_QUERY,
  );
  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) throw new Error("The community feed query returned no data");
  const rawCommunityPosts = await loadCommunityFeedPosts(
    data.communityPosts,
    backendLanguageCode || languageCode,
  );

  const members: CommunityMember[] = [];
  const membersById = new Map<number, CommunityMember>();
  const posts = filterCommunityPostsByLanguage(rawCommunityPosts.flatMap((post) => {
    const author = post.author?.node;
    if (!author) return [];
    let member = membersById.get(author.databaseId);
    if (!member) {
      member = mapMember(author);
      membersById.set(author.databaseId, member);
      members.push(member);
    }
    return [mapCommunityPost(post, member)];
  }), backendLanguageCode || languageCode).slice(0, 12);

  return {
    posts,
    members,
    marketplaceItems: [],
    profilesPublicEnabled: data.communityProfilesPublicEnabled !== false,
    followersEnabled: data.communityFollowersEnabled !== false,
  };
}

const COMMUNITY_MEMBERS_QUERY = /* GraphQL */ `
  query StorefrontCommunityMembers {
    communityMembers {
      databaseId
      name
      nicename
      communityHandle
      description
      avatar(size: 192) { url }
      communityRole
      communityMemberTypes
      communityProfilePublic
      followerCount
      followingCount
      isFollowedByViewer
    }
  }
`;

const LEGACY_COMMUNITY_MEMBERS_QUERY = /* GraphQL */ `
  query StorefrontLegacyCommunityMembers {
    communityMembers {
      databaseId
      name
      nicename
      communityHandle
      description
      avatar(size: 192) { url }
      communityRole
      communityProfilePublic
    }
  }
`;

async function getCommunityMembers(token?: string): Promise<RawUser[]> {
  let query = COMMUNITY_MEMBERS_QUERY;
  let response = await graphqlRequest<{ communityMembers: (RawUser | null)[] | null }>(query, undefined, token);
  if (response.errors?.some(({ message }) => message.includes('Cannot query field "communityMemberTypes"'))) {
    query = removeGraphqlFieldSelections(query, "communityMemberTypes");
    response = await graphqlRequest<{ communityMembers: (RawUser | null)[] | null }>(query, undefined, token);
  }
  if (!response.errors?.length) return (response.data?.communityMembers || []).filter((member): member is RawUser => Boolean(member));
  const missingMemberField = response.errors.some(({ message }) => message.includes('Cannot query field "communityMembers"'));
  if (missingMemberField) return [];
  const followerCompatibilityError = response.errors.every(({ message }) =>
    ["followerCount", "followingCount", "isFollowedByViewer"].some((field) => message.includes(`"${field}"`))
  );
  if (!followerCompatibilityError) throw new Error(response.errors.map(({ message }) => message).join("; "));
  const legacy = await graphqlRequest<{ communityMembers: (RawUser | null)[] | null }>(LEGACY_COMMUNITY_MEMBERS_QUERY, undefined, token);
  if (legacy.errors?.length) throw new Error(legacy.errors.map(({ message }) => message).join("; "));
  return (legacy.data?.communityMembers || []).filter((member): member is RawUser => Boolean(member));
}

export async function getCommunityProfile(
  handle: string,
  languageCode: string,
): Promise<CommunityProfileData | null> {
  const auth = authStore.load();
  const { data, errors } = await communityGraphqlRequest<{ communityProfileByHandle: RawCommunityProfile | null }>(
    COMMUNITY_PROFILE_QUERY,
    {
      handle,
      languageSlug: languageCode.toLowerCase(),
      connectionFirst: 20,
      followersAfter: null,
      followingAfter: null,
    },
    auth?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const profile = data?.communityProfileByHandle;
  if (!profile) return null;
  const member = mapMember(profile);
  const mapPosts = (posts: RawCommunityPost[]) => posts.flatMap((post) => {
    const author = post.author?.node;
    return author ? [mapCommunityPost(post, mapMember(author))] : [];
  });
  return {
    member,
    followers: mapProfileConnection(profile.followers),
    following: mapProfileConnection(profile.following),
    pendingRequests: emptyProfileConnection(),
    posts: filterCommunityPostsByLanguage(mapPosts(profile.posts || []), languageCode),
    followingFeed: filterCommunityPostsByLanguage(mapPosts(profile.followingFeed || []), languageCode),
    products: filterRawNodesByLanguage(profile.products || [], languageCode).map((product) => mapProfileProduct(product)),
    articles: filterRawNodesByLanguage(profile.articles || [], languageCode).map((article) => mapProfileArticle(article, member)),
  };
}

export async function getCommunityProfileMember(handle: string): Promise<CommunityMember | null> {
  const auth = authStore.load();
  const { data, errors } = await communityGraphqlRequest<{ communityProfileByHandle: RawCommunityProfile | null }>(
    COMMUNITY_PROFILE_MEMBER_QUERY,
    { handle },
    auth?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return data?.communityProfileByHandle ? mapMember(data.communityProfileByHandle) : null;
}

export async function getCommunityProfileConnection(
  handle: string,
  direction: "followers" | "following" | "pendingFollowRequests",
  after: string | null,
): Promise<CommunityProfileConnection> {
  const token = authStore.load()?.authToken;
  const query = `query StorefrontCommunityProfileConnection($handle: String!, $after: String) {
    communityProfileByHandle(handle: $handle) {
      ${direction}(first: 20, after: $after) {
        nodes {
          databaseId name nicename communityHandle description
          avatar(size: 192) { url }
          cover { url }
          communityRole communityProfilePublic followerCount followingCount
          isFollowedByViewer relationshipState canAccess isLocked
        }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;
  const { data, errors } = await communityGraphqlRequest<{
    communityProfileByHandle: Record<"followers" | "following" | "pendingFollowRequests", RawCommunityProfileConnection> | null;
  }>(query, { handle, after }, token);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return data?.communityProfileByHandle ? mapProfileConnection(data.communityProfileByHandle[direction]) : emptyProfileConnection();
}

export async function getCommunityProfileDashboard(handle: string): Promise<{
  pendingRequests: CommunityProfileConnection;
  followers: CommunityProfileConnection;
}> {
  const token = authStore.load()?.authToken;
  const { data, errors } = await graphqlRequest<{
    communityProfileByHandle: {
      pendingFollowRequests: RawCommunityProfileConnection;
      followers: RawCommunityProfileConnection;
    } | null;
  }>(
    `query StorefrontCommunityProfileDashboard($handle: String!) {
      communityProfileByHandle(handle: $handle) {
        pendingFollowRequests(first: 20) {
          nodes { databaseId name nicename communityHandle description avatar(size: 192) { url } cover { url } communityRole communityProfilePublic followerCount followingCount isFollowedByViewer relationshipState canAccess isLocked }
          totalCount pageInfo { hasNextPage endCursor }
        }
        followers(first: 20) {
          nodes { databaseId name nicename communityHandle description avatar(size: 192) { url } cover { url } communityRole communityProfilePublic followerCount followingCount isFollowedByViewer relationshipState canAccess isLocked }
          totalCount pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { handle },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const profile = data?.communityProfileByHandle;
  return {
    pendingRequests: profile ? mapProfileConnection(profile.pendingFollowRequests) : emptyProfileConnection(),
    followers: profile ? mapProfileConnection(profile.followers) : emptyProfileConnection(),
  };
}

export async function getCommunityArchiveData(backendLanguageCode: string): Promise<CommunityArchiveData> {
  const auth = authStore.load();
  const members = (await getCommunityMembers(auth?.authToken))
    .filter((member): member is RawUser =>
      Boolean(
        member?.communityProfilePublic === true
        && member.communityHandle?.trim()
        && !member.communityHandle.includes("/"),
      )
    )
    .map(mapMember);
  const membersById = new Map(members.map((member) => [member.databaseId, member]));
  const rawPosts: RawCommunityPost[] = [];
  let after: string | null = null;

  do {
    const response: GraphqlResponse<CommunityArchivePostsResult> = await communityGraphqlRequest<CommunityArchivePostsResult>(
      COMMUNITY_ARCHIVE_POSTS_QUERY,
      { after },
      auth?.authToken,
    );
    const pageData: CommunityArchivePostsResult | null = response.data;
    const errors = response.errors;
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    if (!pageData?.communityPosts) throw new Error("The community tag archive query returned no data");

    rawPosts.push(...pageData.communityPosts.nodes);
    if (!pageData.communityPosts.pageInfo.hasNextPage) break;
    if (!pageData.communityPosts.pageInfo.endCursor) {
      throw new Error("The community tag archive query returned an incomplete pagination cursor");
    }
    after = pageData.communityPosts.pageInfo.endCursor;
  } while (after);

  const localizedRawPosts = rawPosts.filter((post) =>
    !post.language?.code || post.language.code.toLowerCase() === backendLanguageCode.toLowerCase()
  );
  const posts = localizedRawPosts.flatMap((post) => {
    const author = post.author?.node;
    if (!author) return [];
    let eligibleAuthor = membersById.get(author.databaseId);
    if (!eligibleAuthor && author.communityProfilePublic === true && author.communityHandle?.trim()) {
      eligibleAuthor = mapMember(author);
      members.push(eligibleAuthor);
      membersById.set(eligibleAuthor.databaseId, eligibleAuthor);
    }
    return eligibleAuthor?.isPublic
      ? [mapCommunityPost(post, eligibleAuthor)]
      : [];
  });
  const publishedAuthorIds = new Set(
    localizedRawPosts.flatMap((post) => post.author?.node ? [post.author.node.databaseId] : []),
  );
  const tags = new Map<string, CommunityTagSummary>();
  posts.forEach((post) => {
    post.tags.forEach((name, index) => {
      const slug = post.tagSlugs[index];
      if (!name || !slug) return;
      const existing = tags.get(slug);
      if (existing) {
        existing.postCount += 1;
      } else {
        tags.set(slug, { name, slug, postCount: 1 });
      }
    });
  });

  return {
    authors: members
      .filter((member) => isCommunityArchiveAuthor(member, publishedAuthorIds))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    tags: [...tags.values()].sort((left, right) =>
      right.postCount - left.postCount || left.name.localeCompare(right.name)
    ),
    posts,
  };
}

async function getCommunityFeatureFlag(
  field: "communityProfilesPublicEnabled" | "communityFollowersEnabled",
  token?: string,
): Promise<boolean> {
  const { data, errors } = await graphqlRequest<Record<string, boolean>>(
    `query StorefrontCommunityFeatureFlag { ${field} }`,
    undefined,
    token,
  );
  if (errors?.length) {
    if (errors.every(({ message }) => message.includes(`Cannot query field "${field}"`))) return true;
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  return data?.[field] !== false;
}

export async function getCommunityPostByDatabaseId(postId: string): Promise<CommunityPostDetail | null> {
  if (!/^[1-9]\d*$/.test(postId)) return null;

  const { data, errors } = await communityGraphqlRequest<{ contentNode: RawCommunityPostDetail | { __typename: string } | null }>(
    COMMUNITY_POST_QUERY,
    { id: postId },
    authStore.load()?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const node = data?.contentNode || null;
  if (!node || node.__typename !== "CommunityPost") return null;
  const completeNode = await loadRemainingCommunityPostComments(node as RawCommunityPostDetail);
  return mapCommunityPostDetail(completeNode, postId);
}

export function communityPostSlugFromUri(uri: string): string | null {
  const normalizedUri = uri.startsWith("/") ? uri : `/${uri}`;
  const slug = normalizedUri
    .split(/[?#]/, 1)[0]
    .split("/")
    .filter(Boolean)
    .pop();
  return slug ? decodeURIComponent(slug) : null;
}

export async function getCommunityPostByUri(uri: string): Promise<CommunityPostDetail | null> {
  const slug = communityPostSlugFromUri(uri);
  if (!slug) return null;
  const { data, errors } = await communityGraphqlRequest<{ communityPost: RawCommunityPostDetail | { __typename: string } | null }>(
    COMMUNITY_POST_BY_SLUG_QUERY,
    { slug },
    authStore.load()?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const node = data?.communityPost || null;
  if (!node || node.__typename !== "CommunityPost") return null;
  const completeNode = await loadRemainingCommunityPostComments(node as RawCommunityPostDetail);
  return mapCommunityPostDetail(completeNode, uri);
}

async function loadRemainingCommunityPostComments(
  post: RawCommunityPostDetail,
): Promise<RawCommunityPostDetail> {
  const comments = [...post.comments.nodes];
  let pageInfo = post.comments.pageInfo;
  const token = authStore.load()?.authToken;

  while (pageInfo?.hasNextPage) {
    if (!pageInfo.endCursor) {
      throw new Error("The community discussion query returned an incomplete pagination cursor");
    }
    const { data, errors } = await graphqlRequest<{
      contentNode: {
        __typename: "CommunityPost";
        comments: {
          nodes: RawComment[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | { __typename: string } | null;
    }>(
      COMMUNITY_POST_COMMENTS_QUERY,
      { id: String(post.databaseId), after: pageInfo.endCursor },
      token,
    );
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    if (!data?.contentNode || data.contentNode.__typename !== "CommunityPost" || !("comments" in data.contentNode)) {
      throw new Error("The community discussion pagination query returned no post");
    }

    comments.push(...data.contentNode.comments.nodes);
    pageInfo = data.contentNode.comments.pageInfo;
  }

  return {
    ...post,
    comments: {
      nodes: comments,
      pageInfo: pageInfo || { hasNextPage: false, endCursor: null },
    },
  };
}

function mapCommunityPostDetail(
  node: RawCommunityPostDetail | { __typename: string } | null,
  reference: string,
): CommunityPostDetail | null {
  if (!node || node.__typename !== "CommunityPost") return null;
  const rawPost = node as RawCommunityPostDetail;
  const rawAuthor = rawPost.author?.node;
  if (!rawAuthor) throw new Error(`Community post ${reference} has no author`);
  const author = mapMember(rawAuthor);

  return {
    post: mapCommunityPost(rawPost, author),
    author,
    languageCode: rawPost.language?.code?.toLowerCase() || "",
    uri: rawPost.uri || "",
    translations: (rawPost.translations || []).flatMap((translation) => {
      const languageCode = translation.language?.code?.toLowerCase();
      return languageCode ? [{ databaseId: translation.databaseId, languageCode, uri: translation.uri || "" }] : [];
    }),
  };
}

const VIEWER_FIELDS = /* GraphQL */ `
      databaseId
      name
      communityHandle
      description
      avatar(size: 192) {
        url
      }
      communityCover { url }
      communityRole
      communityProfilePublic
      followerCount
      followingCount
`;

const VIEWER_QUERY = /* GraphQL */ `
  query StorefrontCommunityViewer {
    funkycommerceViewer {
${VIEWER_FIELDS}
      storefrontCapabilities
    }
  }
`;

const LEGACY_VIEWER_QUERY = /* GraphQL */ `
  query StorefrontLegacyCommunityViewer {
    funkycommerceViewer {
${VIEWER_FIELDS}
      capabilities
    }
  }
`;

export async function getCommunityViewer(): Promise<CommunityViewer | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  type ViewerResult = {
    funkycommerceViewer: (RawUser & {
      storefrontCapabilities?: string[] | null;
      capabilities?: string[] | null;
    }) | null;
  };
  let { data, errors } = await graphqlRequest<ViewerResult>(VIEWER_QUERY, undefined, token);
  if (errors?.some(({ message }) => message.includes('Cannot query field "storefrontCapabilities"'))) {
    ({ data, errors } = await graphqlRequest<ViewerResult>(LEGACY_VIEWER_QUERY, undefined, token));
  }
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.funkycommerceViewer) return null;
  return {
    ...mapMember(data.funkycommerceViewer),
    capabilities: data.funkycommerceViewer.storefrontCapabilities || data.funkycommerceViewer.capabilities || [],
  };
}

export type CommunityPostMediaInput = {
  attachmentId?: number;
  dataUrl?: string;
};

export type CommunityPostMutationInput = {
  title: string;
  description: string;
  tags: string[];
  media: CommunityPostMediaInput[];
  translationOfId?: number;
};

export async function createCommunityPost(input: CommunityPostMutationInput & { language: string }): Promise<number> {
  const result = await authenticatedMutation<{ publishCommunityPost: { communityPost: { databaseId: number } } }>(
    `mutation PublishCommunityPost(
      $title: String!
      $description: String
      $tags: [String]
      $media: [FunkycommerceCommunityMediaInput]
      $language: String
      $translationOfId: Int
    ) {
      publishCommunityPost(input: {
        title: $title
        description: $description
        tags: $tags
        media: $media
        language: $language
        translationOfId: $translationOfId
      }) {
        communityPost { databaseId }
      }
    }`,
    input,
    "publishCommunityPost",
  );
  return result.publishCommunityPost.communityPost.databaseId;
}

export async function updateCommunityPost(postId: number, input: CommunityPostMutationInput): Promise<void> {
  await authenticatedMutation(
    `mutation UpdateStorefrontCommunityPost(
      $postId: Int!
      $title: String!
      $description: String
      $tags: [String]
      $media: [FunkycommerceCommunityMediaInput]
      $translationOfId: Int
    ) {
      updateStorefrontCommunityPost(input: {
        postId: $postId
        title: $title
        description: $description
        tags: $tags
        media: $media
        translationOfId: $translationOfId
      }) {
        communityPost { databaseId }
      }
    }`,
    { postId, ...input },
    "updateStorefrontCommunityPost",
  );
}

export async function deleteCommunityPost(postId: number): Promise<number> {
  const result = await authenticatedMutation<{ deleteStorefrontCommunityPost: { deletedPostId: number } }>(
    `mutation DeleteStorefrontCommunityPost($postId: Int!) {
      deleteStorefrontCommunityPost(input: { postId: $postId }) { deletedPostId }
    }`,
    { postId },
    "deleteStorefrontCommunityPost",
  );
  return result.deleteStorefrontCommunityPost.deletedPostId;
}

export async function toggleCommunityPostLike(postId: number): Promise<{ liked: boolean; likesCount: number }> {
  const result = await authenticatedMutation<{ toggleCommunityPostLike: { liked: boolean; likesCount: number } }>(
    `mutation ToggleCommunityPostLike($postId: Int!) {
      toggleCommunityPostLike(input: { postId: $postId }) { liked likesCount }
    }`,
    { postId },
    "toggleCommunityPostLike",
  );
  return result.toggleCommunityPostLike;
}

export async function updateCommunityProfileVisibility(isPublic: boolean): Promise<boolean> {
  const result = await authenticatedMutation<{ updateCommunityProfileVisibility: { isPublic: boolean } }>(
    `mutation UpdateCommunityProfileVisibility($isPublic: Boolean!) {
      updateCommunityProfileVisibility(input: { isPublic: $isPublic }) { isPublic }
    }`,
    { isPublic },
    "updateCommunityProfileVisibility",
  );
  return result.updateCommunityProfileVisibility.isPublic;
}

export async function uploadCommunityProfileCover(dataUrl: string): Promise<string | undefined> {
  const result = await authenticatedMutation<{
    uploadCommunityProfileCover: { cover: { url: string | null } | null };
  }>(
    `mutation UploadCommunityProfileCover($dataUrl: String!) {
      uploadCommunityProfileCover(input: { dataUrl: $dataUrl }) { cover { url } }
    }`,
    { dataUrl },
    "uploadCommunityProfileCover",
  );
  return result.uploadCommunityProfileCover.cover?.url || undefined;
}

export async function removeCommunityProfileCover(): Promise<void> {
  await authenticatedMutation(
    `mutation RemoveCommunityProfileCover {
      removeCommunityProfileCover(input: {}) { removed }
    }`,
    {},
    "removeCommunityProfileCover",
  );
}

/** Shared GraphQL input fields for both `createCollaboratorPost` and `updateCollaboratorPost`. */
type CollaboratorPostInput = {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  imageDataUrl?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  translationOfId?: number;
};

export async function createCollaboratorPost(input: CollaboratorPostInput & { language: string }): Promise<void> {
  await authenticatedMutation(
    `mutation CreateCollaboratorPost(
      $title: String!
      $excerpt: String
      $content: String!
      $category: String
      $tags: [String]
      $imageDataUrl: String
      $slug: String
      $metaTitle: String
      $metaDescription: String
      $focusKeyword: String
      $translationOfId: Int
      $language: String
    ) {
      createCollaboratorPost(input: {
        title: $title
        excerpt: $excerpt
        content: $content
        category: $category
        tags: $tags
        imageDataUrl: $imageDataUrl
        slug: $slug
        metaTitle: $metaTitle
        metaDescription: $metaDescription
        focusKeyword: $focusKeyword
        translationOfId: $translationOfId
        language: $language
      }) {
        post { databaseId }
      }
    }`,
    input,
    "createCollaboratorPost",
  );
}

export async function updateCollaboratorPost(input: CollaboratorPostInput & { postId: number }): Promise<void> {
  await authenticatedMutation(
    `mutation UpdateCollaboratorPost(
      $postId: Int!
      $title: String!
      $excerpt: String
      $content: String!
      $category: String
      $tags: [String]
      $imageDataUrl: String
      $slug: String
      $metaTitle: String
      $metaDescription: String
      $focusKeyword: String
      $translationOfId: Int
    ) {
      updateCollaboratorPost(input: {
        postId: $postId
        title: $title
        excerpt: $excerpt
        content: $content
        category: $category
        tags: $tags
        imageDataUrl: $imageDataUrl
        slug: $slug
        metaTitle: $metaTitle
        metaDescription: $metaDescription
        focusKeyword: $focusKeyword
        translationOfId: $translationOfId
      }) {
        post { databaseId }
      }
    }`,
    input,
    "updateCollaboratorPost",
  );
}

export async function deleteCollaboratorPost(postId: number): Promise<number> {
  const result = await authenticatedMutation<{ deleteCollaboratorPost: { deletedPostId: number } }>(
    `mutation DeleteCollaboratorPost($postId: Int!) {
      deleteCollaboratorPost(input: { postId: $postId }) { deletedPostId }
    }`,
    { postId },
    "deleteCollaboratorPost",
  );
  return result.deleteCollaboratorPost.deletedPostId;
}

const COLLABORATOR_POST_FOR_EDITING_QUERY = /* GraphQL */ `
  query StorefrontCollaboratorPostForEditing($id: ID!) {
    post(id: $id, idType: DATABASE_ID) {
      databaseId
      title(format: RAW)
      excerpt(format: RAW)
      content(format: RAW)
      slug
      featuredImage { node { sourceUrl } }
      categories(first: 1) { nodes { name } }
      tags(first: 20) { nodes { name } }
      language { code }
      translations { databaseId language { code } }
      funkycommerceSeo { metaTitle metaDescription focusKeyword }
    }
  }
`;

type RawCollaboratorPostForEditing = {
  databaseId: number;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  slug: string | null;
  featuredImage: { node: { sourceUrl: string | null } } | null;
  categories: { nodes: { name: string | null }[] };
  tags: { nodes: { name: string | null }[] };
  language: { code: string | null } | null;
  translations: { databaseId: number; language: { code: string | null } | null }[];
  funkycommerceSeo: { metaTitle: string | null; metaDescription: string | null; focusKeyword: string | null } | null;
};

/** Loads a collaborator-authored post's editable fields, for pre-filling `WriteArticleModal` in edit mode. */
export async function getCollaboratorPostForEditing(postId: number): Promise<CollaboratorPostForEditing | null> {
  const token = authStore.load()?.authToken;
  const { data, errors } = await graphqlRequest<{ post: RawCollaboratorPostForEditing | null }>(
    COLLABORATOR_POST_FOR_EDITING_QUERY,
    { id: String(postId) },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const post = data?.post;
  if (!post) return null;
  const currentLanguage = post.translations.find((translation) => translation.databaseId === post.databaseId);
  return {
    databaseId: post.databaseId,
    title: post.title || "",
    excerpt: stripHtml(post.excerpt || ""),
    content: post.content || "",
    category: post.categories.nodes[0]?.name || "",
    tags: post.tags.nodes.flatMap(({ name }) => (name ? [name] : [])),
    imageUrl: post.featuredImage?.node.sourceUrl || undefined,
    languageCode: (currentLanguage?.language?.code || post.language?.code || "en").toLowerCase(),
    slug: post.slug || "",
    metaTitle: post.funkycommerceSeo?.metaTitle || "",
    metaDescription: post.funkycommerceSeo?.metaDescription || "",
    focusKeyword: post.funkycommerceSeo?.focusKeyword || "",
    translationOfId: post.translations.find((translation) => translation.databaseId !== post.databaseId)?.databaseId,
  };
}

const TRANSLATION_CANDIDATES_QUERY = /* GraphQL */ `
  query StorefrontTranslationCandidates($search: String!) {
    posts(first: 10, where: { search: $search }) {
      nodes { databaseId title(format: RAW) uri language { code } }
    }
  }
`;

const COMMUNITY_TRANSLATION_CANDIDATES_QUERY = /* GraphQL */ `
  query StorefrontCommunityTranslationCandidates($search: String!) {
    communityPosts(first: 10, where: { search: $search }) {
      nodes { databaseId title(format: RAW) uri language: funkycommerceLanguage { code } }
    }
  }
`;

/**
 * Searches existing posts to populate the "this article is a translation of…" picker.
 * Results in the current post's own language or matching the post being edited are
 * filtered out client-side; the backend independently re-validates on submit.
 */
export async function searchTranslationCandidatePosts(search: string, excludeLanguageCode: string, excludePostId?: number): Promise<TranslationCandidate[]> {
  const trimmed = search.trim();
  if (trimmed.length < 2) return [];
  const token = authStore.load()?.authToken;
  const { data, errors } = await graphqlRequest<{ posts: { nodes: { databaseId: number; title: string | null; uri: string | null; language: { code: string | null } | null }[] } }>(
    TRANSLATION_CANDIDATES_QUERY,
    { search: trimmed },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return filterTranslationCandidates(data?.posts.nodes || [], excludeLanguageCode, excludePostId);
}

export async function searchTranslationCandidateCommunityPosts(
  search: string,
  excludeLanguageCode: string,
  excludePostId?: number,
): Promise<TranslationCandidate[]> {
  const trimmed = search.trim();
  if (trimmed.length < 2) return [];
  const token = authStore.load()?.authToken;
  const { data, errors } = await graphqlRequest<{
    communityPosts: {
      nodes: { databaseId: number; title: string | null; uri: string | null; language: { code: string | null } | null }[];
    };
  }>(COMMUNITY_TRANSLATION_CANDIDATES_QUERY, { search: trimmed }, token);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return filterTranslationCandidates(data?.communityPosts.nodes || [], excludeLanguageCode, excludePostId);
}

/** Shared GraphQL input fields for both `createMarketplaceProduct` and `updateMarketplaceProduct`. */
type MarketplaceProductInput = {
  name: string;
  subtitle: string;
  description: string;
  category: string;
  brand: string;
  upsellIds: number[];
  crossSellIds: number[];
  sku: string;
  currency: string;
  price: number;
  regularPrice?: number;
  stockQuantity: number;
  imageDataUrls: string[];
  isVirtual: boolean;
  isDownloadable: boolean;
  downloadableFiles: DownloadableFileInput[];
  downloadLimit?: number;
  downloadExpiryDays?: number;
  externalUrl?: string;
  buttonText?: string;
  attributes: { name: string; options: string[] }[];
  variations: {
    variationId?: number;
    attributes: { name: string; option: string }[];
    sku: string;
    price: number;
    regularPrice?: number;
    stockQuantity: number;
    imageIndex: number;
    isVirtual: boolean;
    isDownloadable: boolean;
    downloadableFiles: DownloadableFileInput[];
    downloadLimit?: number;
    downloadExpiryDays?: number;
  }[];
};

const MARKETPLACE_PRODUCT_MUTATION_VARIABLES = `
      $name: String!
      $subtitle: String
      $description: String
      $category: String
      $brand: String
      $upsellIds: [Int]
      $crossSellIds: [Int]
      $sku: String
      $currency: String
      $price: Float!
      $regularPrice: Float
      $stockQuantity: Int
      $imageDataUrls: [String]
      $isVirtual: Boolean
      $isDownloadable: Boolean
      $downloadableFiles: [FunkycommerceDownloadableFileInput]
      $downloadLimit: Int
      $downloadExpiryDays: Int
      $externalUrl: String
      $buttonText: String
      $attributes: [FunkycommerceMarketplaceAttributeInput]
      $variations: [FunkycommerceMarketplaceVariationInput]
`;

const MARKETPLACE_PRODUCT_MUTATION_FIELDS = `
        name: $name
        subtitle: $subtitle
        description: $description
        category: $category
        brand: $brand
        upsellIds: $upsellIds
        crossSellIds: $crossSellIds
        sku: $sku
        currency: $currency
        price: $price
        regularPrice: $regularPrice
        stockQuantity: $stockQuantity
        imageDataUrls: $imageDataUrls
        isVirtual: $isVirtual
        isDownloadable: $isDownloadable
        downloadableFiles: $downloadableFiles
        downloadLimit: $downloadLimit
        downloadExpiryDays: $downloadExpiryDays
        externalUrl: $externalUrl
        buttonText: $buttonText
        attributes: $attributes
        variations: $variations
`;

export async function createMarketplaceProduct(input: MarketplaceProductInput & { productType: MarketplaceProductType; language: string }): Promise<void> {
  await authenticatedMutation(
    `mutation CreateMarketplaceProduct(
      ${MARKETPLACE_PRODUCT_MUTATION_VARIABLES}
      $productType: String
      $language: String
    ) {
      createMarketplaceProduct(input: {
        ${MARKETPLACE_PRODUCT_MUTATION_FIELDS}
        productType: $productType
        language: $language
      }) {
        product { databaseId }
      }
    }`,
    input,
    "createMarketplaceProduct",
  );
}

export async function updateMarketplaceProduct(input: MarketplaceProductInput & { productId: number }): Promise<void> {
  await authenticatedMutation(
    `mutation UpdateMarketplaceProduct(
      $productId: Int!
      ${MARKETPLACE_PRODUCT_MUTATION_VARIABLES}
    ) {
      updateMarketplaceProduct(input: {
        productId: $productId
        ${MARKETPLACE_PRODUCT_MUTATION_FIELDS}
      }) {
        product { databaseId }
      }
    }`,
    input,
    "updateMarketplaceProduct",
  );
}

export const MARKETPLACE_PRODUCT_FOR_EDITING_QUERY = /* GraphQL */ `
  query StorefrontMarketplaceProductForEditing($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      databaseId
      name
      slug
      description
      shortDescription
      sku
      image { sourceUrl }
      galleryImages { nodes { sourceUrl } }
      productCategories(first: 1) { nodes { name } }
      productBrands(first: 1) { nodes { name } }
      upsell(first: 20) { nodes { databaseId } }
      ... on SimpleProduct {
        crossSell(first: 20) { nodes { databaseId } }
        price(format: RAW)
        regularPrice(format: RAW)
        stockQuantity
        virtual
        downloadable
        downloadLimit
        downloadExpiry
        downloads { name file }
      }
      ... on VariableProduct {
        crossSell(first: 20) { nodes { databaseId } }
        virtual
        attributes { nodes { name options } }
        variations(first: 100) {
          nodes {
            databaseId
            sku
            price(format: RAW)
            regularPrice(format: RAW)
            stockQuantity
            virtual
            downloadable
            downloadLimit
            downloadExpiry
            downloads { name file }
            attributes { nodes { name value } }
          }
        }
      }
      ... on ExternalProduct {
        price(format: RAW)
        regularPrice(format: RAW)
        externalUrl
        buttonText
      }
    }
  }
`;

export type RawMarketplaceProductForEditing = {
  __typename: string;
  databaseId: number;
  name: string | null;
  description: string | null;
  shortDescription: string | null;
  sku: string | null;
  image: { sourceUrl: string | null } | null;
  galleryImages: { nodes: { sourceUrl: string | null }[] };
  productCategories: { nodes: { name: string | null }[] };
  productBrands: { nodes: { name: string | null }[] };
  upsell: { nodes: { databaseId: number }[] };
  crossSell?: { nodes: { databaseId: number }[] };
  price?: string | null;
  regularPrice?: string | null;
  stockQuantity?: number | null;
  virtual?: boolean | null;
  downloadable?: boolean | null;
  downloadLimit?: number | null;
  downloadExpiry?: number | null;
  downloads?: { name: string | null; file: string | null }[];
  externalUrl?: string | null;
  buttonText?: string | null;
  attributes?: { nodes: { name: string | null; options: string[] | null }[] };
  variations?: {
    nodes: {
      databaseId: number;
      sku: string | null;
      price: string | null;
      regularPrice: string | null;
      stockQuantity: number | null;
      virtual?: boolean | null;
      downloadable?: boolean | null;
      downloadLimit?: number | null;
      downloadExpiry?: number | null;
      downloads?: { name: string | null; file: string | null }[];
      attributes: { nodes: { name: string | null; value: string | null }[] };
    }[];
  };
};

/** Loads a collaborator-owned product's editable fields, for pre-filling `ListProductModal` in edit mode. */
export async function getMarketplaceProductForEditing(productId: number): Promise<MarketplaceProductForEditing | null> {
  const token = authStore.load()?.authToken;
  const { data, errors } = await graphqlRequest<{ product: RawMarketplaceProductForEditing | null }>(
    MARKETPLACE_PRODUCT_FOR_EDITING_QUERY,
    { id: String(productId) },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  const product = data?.product;
  if (!product) return null;
  return mapMarketplaceProductForEditing(product);
}

export function mapMarketplaceProductForEditing(product: RawMarketplaceProductForEditing): MarketplaceProductForEditing {
  const productType: MarketplaceProductType = product.__typename === "VariableProduct"
    ? "variable"
    : product.__typename === "ExternalProduct"
      ? "external"
      : "simple";
  return {
    databaseId: product.databaseId,
    name: product.name || "",
    subtitle: stripHtml(product.shortDescription || ""),
    description: product.description || "",
    category: product.productCategories.nodes[0]?.name || "",
    brand: product.productBrands.nodes[0]?.name || "",
    upsellIds: product.upsell.nodes.map(({ databaseId }) => databaseId),
    crossSellIds: (product.crossSell?.nodes || []).map(({ databaseId }) => databaseId),
    productType,
    sku: product.sku || "",
    stockQuantity: product.stockQuantity ?? 0,
    priceLabel: product.price || "",
    compareAtPriceLabel: product.regularPrice && product.regularPrice !== product.price ? product.regularPrice : "",
    imageUrls: [product.image?.sourceUrl, ...(product.galleryImages.nodes.map((node) => node.sourceUrl))].flatMap((url) => (url ? [url] : [])),
    isVirtual: product.virtual ?? false,
    isDownloadable: product.downloadable ?? false,
    downloadLimit: product.downloadLimit ?? 0,
    downloadExpiryDays: product.downloadExpiry ?? 0,
    existingDownloadNames: (product.downloads || []).flatMap((download) => (download.name ? [download.name] : [])),
    externalUrl: product.externalUrl || "",
    buttonText: product.buttonText || "",
    attributes: (product.attributes?.nodes || []).flatMap((attribute) => (attribute.name && attribute.options?.length ? [{ name: attribute.name, options: attribute.options }] : [])),
    variations: (product.variations?.nodes || []).map((variation) => ({
      databaseId: variation.databaseId,
      attributes: variation.attributes.nodes.flatMap(({ name, value }) => (name && value ? [{ name, option: value }] : [])),
      sku: variation.sku && variation.sku !== product.sku ? variation.sku : "",
      priceLabel: variation.price || "",
      compareAtPriceLabel: variation.regularPrice && variation.regularPrice !== variation.price ? variation.regularPrice : "",
      stockQuantity: variation.stockQuantity ?? 0,
      isVirtual: variation.virtual ?? false,
      isDownloadable: variation.downloadable ?? false,
      downloadLimit: variation.downloadLimit ?? 0,
      downloadExpiryDays: variation.downloadExpiry ?? 0,
      existingDownloadNames: (variation.downloads || []).flatMap((download) => (download.name ? [download.name] : [])),
    })),
  };
}

async function authenticatedMutation<T = Record<string, unknown>>(
  mutation: string,
  variables: Record<string, unknown>,
  field: string,
): Promise<T> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in with an eligible publishing account first");
  const { data, errors } = await graphqlRequest<T>(mutation, variables, token);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error(`${field} returned no data`);
  return data;
}

export async function toggleFollowUser(userId: number): Promise<{ isFollowed: boolean; followerCount: number; relationshipState: CommunityRelationshipState }> {
  const result = await authenticatedMutation<{ toggleFollowUser: { isFollowed: boolean; followerCount: number; relationshipState: CommunityRelationshipState } }>(
    `mutation ToggleFollowUser($userId: Int!) {
      toggleFollowUser(input: { userId: $userId }) { isFollowed followerCount relationshipState }
    }`,
    { userId },
    "toggleFollowUser",
  );
  return result.toggleFollowUser;
}

export async function followCommunityProfile(userId: number): Promise<{ relationshipState: CommunityRelationshipState; followerCount: number }> {
  const result = await authenticatedMutation<{
    followCommunityProfile: { relationshipState: CommunityRelationshipState; followerCount: number };
  }>(
    `mutation FollowCommunityProfile($userId: Int!) {
      followCommunityProfile(input: { userId: $userId }) { relationshipState followerCount }
    }`,
    { userId },
    "followCommunityProfile",
  );
  return result.followCommunityProfile;
}

export async function unfollowCommunityProfile(userId: number): Promise<{ relationshipState: CommunityRelationshipState; followerCount: number }> {
  const result = await authenticatedMutation<{
    unfollowCommunityProfile: { relationshipState: CommunityRelationshipState; followerCount: number };
  }>(
    `mutation UnfollowCommunityProfile($userId: Int!) {
      unfollowCommunityProfile(input: { userId: $userId }) { relationshipState followerCount }
    }`,
    { userId },
    "unfollowCommunityProfile",
  );
  return result.unfollowCommunityProfile;
}

export async function manageCommunityFollower(
  followerUserId: number,
  action: "approve" | "decline" | "remove",
): Promise<void> {
  await authenticatedMutation(
    `mutation ManageCommunityFollower($followerUserId: Int!, $action: String!) {
      manageCommunityFollower(input: { followerUserId: $followerUserId, action: $action }) {
        relationshipState followerCount
      }
    }`,
    { followerUserId, action },
    "manageCommunityFollower",
  );
}

function mapMember(user: RawUser): CommunityMember {
  const relationshipState = user.relationshipState === "pending"
    || user.relationshipState === "accepted"
    || user.relationshipState === "owner"
    ? user.relationshipState
    : "none";
  const role = user.communityRole === "collaborator"
    ? "collaborator"
    : user.communityRole === "creator"
      ? "creator"
      : "member";
  const memberTypes = (user.communityMemberTypes || [role])
    .filter((type): type is CommunityMember["memberTypes"][number] =>
      ["member", "customer", "subscriber", "admin", "creator", "collaborator"].includes(type),
    );
  return {
    databaseId: user.databaseId,
    handle: communityHandleFromUser(user),
    displayName: user.name || user.nicename || "Community member",
    bio: user.description || "",
    avatarUrl: user.avatar?.url || undefined,
    role,
    memberTypes: Array.from(new Set(memberTypes.length ? memberTypes : [role])),
    isPublic: user.communityProfilePublic !== false,
    followerCount: user.followerCount ?? 0,
    followingCount: user.followingCount ?? 0,
    isFollowedByViewer: user.isFollowedByViewer ?? false,
    coverUrl: user.cover?.url || user.communityCover?.url || undefined,
    relationshipState,
    canAccess: user.canAccess ?? user.communityProfilePublic !== false,
    isLocked: user.isLocked ?? user.communityProfilePublic === false,
  };
}

function emptyProfileConnection(): CommunityProfileConnection {
  return { nodes: [], totalCount: 0, hasNextPage: false, endCursor: null };
}

function mapProfileConnection(connection: RawCommunityProfileConnection | null | undefined): CommunityProfileConnection {
  if (!connection) return emptyProfileConnection();
  return {
    nodes: (connection.nodes || []).map(mapMember),
    totalCount: connection.totalCount ?? 0,
    hasNextPage: connection.pageInfo?.hasNextPage ?? false,
    endCursor: connection.pageInfo?.endCursor ?? null,
  };
}

function mapProfileProduct(product: RawProduct): ProductCardData {
  const brand = product.productBrands?.nodes?.find(({ name }) => name);
  const engagementRating = mapPublicEngagementRating(product.engagementRating);
  return {
    id: product.id,
    databaseId: product.databaseId,
    name: product.name || "Untitled listing",
    subtitle: stripHtml(product.shortDescription || "") || undefined,
    category: "Marketplace",
    priceLabel: product.price || product.salePrice || product.regularPrice || "",
    priceAmount: parseLocalizedPrice(product.price || product.salePrice || product.regularPrice || "") ?? undefined,
    compareAtPriceLabel: product.salePrice ? product.regularPrice || undefined : undefined,
    compareAtPriceAmount: product.salePrice ? parseLocalizedPrice(product.regularPrice || "") ?? undefined : undefined,
    rating: engagementRating.average ?? undefined,
    reviewCount: engagementRating.count,
    imageUrl: product.image?.sourceUrl || undefined,
    brand: brand?.name || undefined,
    brandHref: brand?.uri || undefined,
    href: product.uri || (product.slug ? `/shop/${product.slug}` : "/shop"),
    productType: resolveCommerceProductType(product.__typename),
    externalUrl: product.__typename === "ExternalProduct" ? product.externalUrl || undefined : undefined,
  };
}

function mapProfileArticle(article: RawProfileArticle, member: CommunityMember): PostCardData {
  const title = stripHtml(article.title || "") || "Untitled article";
  const excerpt = stripHtml(article.excerpt || "");
  const words = `${title} ${excerpt}`.trim().split(/\s+/).filter(Boolean).length;
  return {
    id: article.id,
    databaseId: article.databaseId,
    authorDatabaseId: member.databaseId,
    slug: article.slug || String(article.databaseId),
    title,
    excerpt,
    imageUrl: article.featuredImage?.node?.sourceUrl || undefined,
    date: article.date || new Date(0).toISOString(),
    lastEditedDate: article.modified || undefined,
    languageCode: article.language?.code?.toLowerCase() || "",
    author: { name: member.displayName, avatarUrl: member.avatarUrl, slug: member.handle },
    wordCount: words,
    readingTimeMinutes: Math.max(1, Math.ceil(words / 220)),
    href: article.uri || `/community/${member.handle}/articles/${article.slug || article.databaseId}`,
  };
}

function mapCommunityPost(post: RawCommunityPost, member: CommunityMember): CommunityPostData {
  const media: SocialPostMedia[] = (post.media || []).flatMap((item) =>
    item?.url && (item.mediaType === "image" || item.mediaType === "video")
      ? [{
          databaseId: item.databaseId,
          url: item.url,
          mimeType: item.mimeType,
          mediaType: item.mediaType,
          altText: item.altText || "",
          width: item.width || undefined,
          height: item.height || undefined,
          srcSet: item.srcSet || undefined,
          sizes: item.sizes || undefined,
        }]
      : [],
  );
  if (!media.length && post.featuredImage?.node.sourceUrl) {
    media.push({
      databaseId: 0,
      url: post.featuredImage.node.sourceUrl,
      mimeType: "image/jpeg",
      mediaType: "image",
      altText: stripHtml(post.title || ""),
      width: post.featuredImage.node.mediaDetails?.width || undefined,
      height: post.featuredImage.node.mediaDetails?.height || undefined,
      srcSet: post.featuredImage.node.srcSet || undefined,
    });
  }
  const primaryMedia = media[0];
  const width = primaryMedia?.width || post.featuredImage?.node.mediaDetails?.width || 4;
  const height = primaryMedia?.height || post.featuredImage?.node.mediaDetails?.height || 5;
  const tags = post.communityTags.nodes.flatMap(({ name, slug }) =>
    name && slug ? [{ name, slug }] : []
  );
  const title = stripHtml(post.title || "") || "Community post";
  const descriptionHtml = post.description ?? post.content ?? "";
  const description = stripHtml(descriptionHtml);
  const engagementRating = mapPublicEngagementRating(post.engagementRating);
  return {
    id: String(post.databaseId),
    href: post.uri || `/community/post/${post.databaseId}`,
    databaseId: post.databaseId,
    languageCode: post.language?.code?.toLowerCase() || "",
    image: post.featuredImage?.node.sourceUrl || media.find((item) => item.mediaType === "image")?.url || "",
    imageSrcSet: post.featuredImage?.node.srcSet || undefined,
    aspect: `${width}/${height}`,
    title,
    description,
    caption: description || title,
    media,
    contentHtml: descriptionHtml,
    tags: tags.map(({ name }) => name),
    tagSlugs: tags.map(({ slug }) => slug),
    likes: post.likesCount,
    comments: post.commentCount ?? post.comments?.nodes.length ?? 0,
    createdAt: post.date || new Date(0).toISOString(),
    likedByViewer: post.likedByViewer === true,
    canEdit: post.canEdit === true,
    canDelete: post.canDelete === true,
    ratingAverage: engagementRating.average ?? undefined,
    engagementRating,
    author: {
      handle: member.handle,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
    },
    reviews: post.comments?.nodes.map(mapComment) ?? [],
  };
}

function mapComment(comment: RawComment): ProductReview {
  return {
    id: comment.id,
    databaseId: comment.databaseId,
    author: comment.author?.node?.name || "Community member",
    rating: comment.rating ?? undefined,
    date: comment.date || new Date(0).toISOString(),
    content: stripHtml(comment.content || ""),
    parentId: comment.parentId,
    parentDatabaseId: comment.parentDatabaseId,
  };
}

function stripHtml(value: string): string {
  return normalizeDisplayLabel(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
