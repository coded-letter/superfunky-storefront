import { parseLocalizedPrice, type ProductCardData, type SocialPostCardData } from "@funky/ui";
import type { ProductReview } from "../pages/shared";
import { authStore } from "./auth";
import { graphqlRequest } from "./graphqlClient";
import { filterTranslationCandidates } from "./translationCandidates";

export type CommunityMember = {
  databaseId: number;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  role: "member" | "creator" | "collaborator";
  isPublic: boolean;
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
};

export type CommunityPostData = SocialPostCardData & {
  databaseId: number;
  likedByViewer: boolean;
  ratingAverage?: number;
  reviews: ProductReview[];
  contentHtml: string;
};

export type CommunityPostDetail = {
  post: CommunityPostData;
  author: CommunityMember;
  languageCode: string;
  uri: string;
  translations: { databaseId: number; languageCode: string; uri: string }[];
};

/** SEO fields mirrored from the site's Yoast-shaped `seo` query field (see `Seo.tsx`). */
export type SeoFieldsInput = {
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
};

export type DownloadableFileInput = { name: string; fileDataUrl: string };

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
  productType: "simple" | "variable";
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
  attributes: { name: string; options: string[] }[];
  variations: {
    attributes: { name: string; option: string }[];
    sku: string;
    priceLabel: string;
    compareAtPriceLabel: string;
    stockQuantity: number;
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
  communityProfilePublic: boolean | null;
  followerCount?: number | null;
  followingCount?: number | null;
  isFollowedByViewer?: boolean | null;
};

type RawComment = {
  id: string;
  databaseId: number;
  content: string | null;
  date: string | null;
  parentId: string | null;
  rating: number | null;
  author: { node: { name: string | null } | null } | null;
};

type RawCommunityPost = {
  id: string;
  databaseId: number;
  uri: string | null;
  content: string | null;
  date: string | null;
  likesCount: number;
  likedByViewer: boolean;
  ratingAverage: number | null;
  featuredImage: { node: { sourceUrl: string | null; mediaDetails: { width: number | null; height: number | null } | null } } | null;
  communityTags: { nodes: { name: string | null }[] };
  author: { node: RawUser | null } | null;
  comments: { nodes: RawComment[] };
};

type RawCommunityPostDetail = RawCommunityPost & {
  __typename: "CommunityPost";
  language: { code: string | null } | null;
  translations: { databaseId: number; uri: string | null; language: { code: string | null } | null }[];
};

type RawProduct = {
  __typename: string;
  id: string;
  name: string | null;
  slug: string | null;
  uri: string | null;
  shortDescription: string | null;
  image: { sourceUrl: string | null } | null;
  productBrands: { nodes: { name: string | null; uri: string | null }[] };
  seller: RawUser | null;
  averageRating: number | null;
  reviewCount: number | null;
  price?: string | null;
  regularPrice?: string | null;
  salePrice?: string | null;
  variations?: {
    nodes: {
      id: string;
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
  communityPosts: { nodes: RawCommunityPost[] };
  communityMembers: (RawUser | null)[] | null;
  marketplaceProducts: (RawProduct | null)[] | null;
  viewerMarketplaceProducts?: (RawProduct | null)[] | null;
  communityFollowersEnabled: boolean;
};

const COMMUNITY_QUERY = /* GraphQL */ `
  query StorefrontCommunity($language: LanguageCodeFilterEnum, $languageSlug: String, $viewerSellerId: Int, $hasViewer: Boolean!) {
    communityFollowersEnabled
    communityPosts(first: 100, where: { status: PUBLISH, language: $language }) {
      nodes {
        id
        databaseId
        uri
        content(format: RENDERED)
        date
        likesCount
        likedByViewer
        ratingAverage
        featuredImage {
          node {
            sourceUrl(size: LARGE)
            mediaDetails {
              width
              height
            }
          }
        }
        communityTags {
          nodes {
            name
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
        comments(first: 100, where: { parent: 0, statusIn: [APPROVE] }) {
          nodes {
            id
            databaseId
            content(format: RENDERED)
            date
            parentId
            rating
            author {
              node {
                name
              }
            }
          }
        }
      }
    }
    communityMembers {
      databaseId
      name
      communityHandle
      description
      avatar(size: 192) {
        url
      }
      communityRole
      communityProfilePublic
      followerCount
      followingCount
      isFollowedByViewer
    }
    marketplaceProducts(first: 48, language: $languageSlug) {
      __typename
      id
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
      averageRating
      reviewCount
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
    }
    viewerMarketplaceProducts: marketplaceProducts(first: 48, language: $languageSlug, sellerId: $viewerSellerId) @include(if: $hasViewer) {
      __typename
      id
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
      averageRating
      reviewCount
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
    }
  }
`;

const COMMUNITY_POST_FIELDS = /* GraphQL */ `
  fragment StorefrontCommunityPostFields on CommunityPost {
    id
    databaseId
    uri
    content(format: RENDERED)
    date
    likesCount
    likedByViewer
    ratingAverage
    language {
      code
    }
    translations {
      databaseId
      uri
      language {
        code
      }
    }
    featuredImage {
      node {
        sourceUrl(size: LARGE)
        mediaDetails {
          width
          height
        }
      }
    }
    communityTags {
      nodes {
        name
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
    comments(first: 100, where: { parent: 0, statusIn: [APPROVE] }) {
      nodes {
        id
        databaseId
        content(format: RENDERED)
        date
        parentId
        rating
        author {
          node {
            name
          }
        }
      }
    }
  }
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

const COMMUNITY_POST_BY_URI_QUERY = /* GraphQL */ `
  query StorefrontCommunityPostByUri($uri: String!) {
    nodeByUri(uri: $uri) {
      __typename
      ...StorefrontCommunityPostFields
    }
  }
  ${COMMUNITY_POST_FIELDS}
`;

export async function getCommunityData(languageCode: string, backendLanguageCode: string): Promise<CommunityData> {
  const auth = authStore.load();
  const { data, errors } = await graphqlRequest<CommunityQueryResult>(
    COMMUNITY_QUERY,
    {
      language: backendLanguageCode,
      languageSlug: languageCode.toLowerCase(),
      viewerSellerId: auth?.user?.databaseId || null,
      hasViewer: Boolean(auth?.user?.databaseId),
    },
    auth?.authToken,
  );
  if (errors?.length) {
    // If only the followers fields are missing (schema not yet updated), degrade gracefully.
    const nonFollowerErrors = errors.filter(({ message }) =>
      !message.includes('"followerCount"') && !message.includes('"followingCount"') && !message.includes('"isFollowedByViewer"') && !message.includes('"communityFollowersEnabled"')
    );
    if (nonFollowerErrors.length) throw new Error(nonFollowerErrors.map(({ message }) => message).join("; "));
  }
  if (!data) throw new Error("The community query returned no data");
  const profilesPublicEnabled = await getCommunityProfilesPublicEnabled(auth?.authToken);
  const followersEnabled = data.communityFollowersEnabled !== false;

  const members = (data.communityMembers || []).filter((member): member is RawUser => Boolean(member)).map(mapMember);
  const membersById = new Map(members.map((member) => [member.databaseId, member]));
  const posts = data.communityPosts.nodes.flatMap((post) => {
    const author = post.author?.node;
    if (!author) return [];
    const member = membersById.get(author.databaseId) || mapMember(author);
    return [mapCommunityPost(post, member)];
  });

  const seenProductIds = new Set<string>();
  const marketplaceItems = [...(data.viewerMarketplaceProducts || []), ...(data.marketplaceProducts || [])].flatMap((product) => {
    if (!product) return [];
    if (seenProductIds.has(product.id)) return [];
    seenProductIds.add(product.id);
    const owner = product.seller;
    if (!owner) return [];
    const vendor = membersById.get(owner.databaseId) || mapMember(owner);
    const brand = product.productBrands.nodes.find(({ name }) => name);
    const variations = (product.variations?.nodes || []).flatMap((variation) => {
      const priceAmount = parseLocalizedPrice(variation.price || variation.salePrice || variation.regularPrice || "");
      if (priceAmount === null) return [];
      const regularPriceAmount = parseLocalizedPrice(variation.regularPrice || "");
      return [{
        id: variation.id,
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
    return [{
      vendor,
      product: {
        id: product.id,
        name: product.name || "Untitled listing",
        subtitle: stripHtml(product.shortDescription || "") || undefined,
        category: "Marketplace",
        priceLabel: product.price || "",
        priceAmount: variablePriceAmounts.length ? Math.min(...variablePriceAmounts) : fallbackPriceAmount,
        compareAtPriceLabel: product.salePrice ? product.regularPrice || undefined : undefined,
        compareAtPriceAmount: product.salePrice ? parseLocalizedPrice(product.regularPrice || "") ?? undefined : undefined,
        rating: product.averageRating ?? undefined,
        reviewCount: product.reviewCount ?? undefined,
        imageUrl: product.image?.sourceUrl || undefined,
        brand: brand?.name || undefined,
        brandHref: brand?.uri || undefined,
        href: product.uri || (product.slug ? `/shop/${product.slug}` : "/shop"),
        productType: product.__typename === "VariableProduct" ? "variable" as const : "simple" as const,
        variations: variations.length ? variations : undefined,
        variationOptions: variationOptions.length ? variationOptions : undefined,
      },
    }];
  });

  return { posts, members, marketplaceItems, profilesPublicEnabled, followersEnabled };
}

async function getCommunityProfilesPublicEnabled(token?: string): Promise<boolean> {
  const { data, errors } = await graphqlRequest<{ communityProfilesPublicEnabled: boolean }>(
    `query StorefrontCommunityProfileAvailability {
      communityProfilesPublicEnabled
    }`,
    undefined,
    token,
  );
  if (errors?.length) {
    const fieldIsUnavailable = errors.every(({ message }) => message.includes('Cannot query field "communityProfilesPublicEnabled"'));
    if (fieldIsUnavailable) return true;
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  return data?.communityProfilesPublicEnabled !== false;
}

export async function getCommunityPostByDatabaseId(postId: string): Promise<CommunityPostDetail | null> {
  if (!/^[1-9]\d*$/.test(postId)) return null;

  const { data, errors } = await graphqlRequest<{ contentNode: RawCommunityPostDetail | { __typename: string } | null }>(
    COMMUNITY_POST_QUERY,
    { id: postId },
    authStore.load()?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return mapCommunityPostDetail(data?.contentNode || null, postId);
}

export async function getCommunityPostByUri(uri: string): Promise<CommunityPostDetail | null> {
  const normalizedUri = uri.startsWith("/") ? uri : `/${uri}`;
  const { data, errors } = await graphqlRequest<{ nodeByUri: RawCommunityPostDetail | { __typename: string } | null }>(
    COMMUNITY_POST_BY_URI_QUERY,
    { uri: normalizedUri.endsWith("/") ? normalizedUri : `${normalizedUri}/` },
    authStore.load()?.authToken,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return mapCommunityPostDetail(data?.nodeByUri || null, normalizedUri);
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
    languageCode: rawPost.language?.code?.toLowerCase() || "en",
    uri: rawPost.uri || "",
    translations: rawPost.translations.flatMap((translation) => {
      const languageCode = translation.language?.code?.toLowerCase();
      return languageCode ? [{ databaseId: translation.databaseId, languageCode, uri: translation.uri || "" }] : [];
    }),
  };
}

const VIEWER_QUERY = /* GraphQL */ `
  query StorefrontCommunityViewer {
    funkycommerceViewer {
      databaseId
      name
      communityHandle
      description
      capabilities
      avatar(size: 192) {
        url
      }
      communityRole
      communityProfilePublic
      followerCount
      followingCount
    }
  }
`;

export async function getCommunityViewer(): Promise<CommunityViewer | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  const { data, errors } = await graphqlRequest<{ funkycommerceViewer: (RawUser & { capabilities: string[] | null }) | null }>(VIEWER_QUERY, undefined, token);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.funkycommerceViewer) return null;
  return { ...mapMember(data.funkycommerceViewer), capabilities: data.funkycommerceViewer.capabilities || [] };
}

export async function createCommunityPost(input: { caption: string; tags: string[]; imageDataUrl: string; language: string }): Promise<void> {
  await authenticatedMutation(
    `mutation PublishCommunityPost($caption: String!, $tags: [String], $imageDataUrl: String!, $language: String) {
      publishCommunityPost(input: { caption: $caption, tags: $tags, imageDataUrl: $imageDataUrl, language: $language }) {
        communityPost { databaseId }
      }
    }`,
    input,
    "publishCommunityPost",
  );
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
  attributes: { name: string; options: string[] }[];
  variations: {
    attributes: { name: string; option: string }[];
    sku: string;
    price: number;
    regularPrice?: number;
    stockQuantity: number;
    imageIndex: number;
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
        attributes: $attributes
        variations: $variations
`;

export async function createMarketplaceProduct(input: MarketplaceProductInput & { productType: "simple" | "variable"; language: string }): Promise<void> {
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

const MARKETPLACE_PRODUCT_FOR_EDITING_QUERY = /* GraphQL */ `
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
      crossSell(first: 20) { nodes { databaseId } }
      ... on SimpleProduct {
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
        virtual
        downloadable
        downloadLimit
        downloadExpiry
        downloads { name file }
        attributes { nodes { name options } }
        variations(first: 100) {
          nodes {
            sku
            price(format: RAW)
            regularPrice(format: RAW)
            stockQuantity
            attributes { nodes { name value } }
          }
        }
      }
    }
  }
`;

type RawMarketplaceProductForEditing = {
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
  crossSell: { nodes: { databaseId: number }[] };
  price?: string | null;
  regularPrice?: string | null;
  stockQuantity?: number | null;
  virtual?: boolean | null;
  downloadable?: boolean | null;
  downloadLimit?: number | null;
  downloadExpiry?: number | null;
  downloads?: { name: string | null; file: string | null }[];
  attributes?: { nodes: { name: string | null; options: string[] | null }[] };
  variations?: {
    nodes: {
      sku: string | null;
      price: string | null;
      regularPrice: string | null;
      stockQuantity: number | null;
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
  const isVariable = product.__typename === "VariableProduct";
  return {
    databaseId: product.databaseId,
    name: product.name || "",
    subtitle: stripHtml(product.shortDescription || ""),
    description: product.description || "",
    category: product.productCategories.nodes[0]?.name || "",
    brand: product.productBrands.nodes[0]?.name || "",
    upsellIds: product.upsell.nodes.map(({ databaseId }) => databaseId),
    crossSellIds: product.crossSell.nodes.map(({ databaseId }) => databaseId),
    productType: isVariable ? "variable" : "simple",
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
    attributes: (product.attributes?.nodes || []).flatMap((attribute) => (attribute.name && attribute.options?.length ? [{ name: attribute.name, options: attribute.options }] : [])),
    variations: (product.variations?.nodes || []).map((variation) => ({
      attributes: variation.attributes.nodes.flatMap(({ name, value }) => (name && value ? [{ name, option: value }] : [])),
      sku: variation.sku || "",
      priceLabel: variation.price || "",
      compareAtPriceLabel: variation.regularPrice && variation.regularPrice !== variation.price ? variation.regularPrice : "",
      stockQuantity: variation.stockQuantity ?? 0,
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

export async function toggleFollowUser(userId: number): Promise<{ isFollowed: boolean; followerCount: number }> {
  const result = await authenticatedMutation<{ toggleFollowUser: { isFollowed: boolean; followerCount: number } }>(
    `mutation ToggleFollowUser($userId: Int!) {
      toggleFollowUser(input: { userId: $userId }) { isFollowed followerCount }
    }`,
    { userId },
    "toggleFollowUser",
  );
  return result.toggleFollowUser;
}

function mapMember(user: RawUser): CommunityMember {
  return {
    databaseId: user.databaseId,
    handle: user.communityHandle || user.nicename || `member-${user.databaseId}`,
    displayName: user.name || user.nicename || "Community member",
    bio: user.description || "",
    avatarUrl: user.avatar?.url || undefined,
    role: user.communityRole === "collaborator"
      ? "collaborator"
      : user.communityRole === "creator"
        ? "creator"
        : "member",
    isPublic: user.communityProfilePublic !== false,
    followerCount: user.followerCount ?? 0,
    followingCount: user.followingCount ?? 0,
    isFollowedByViewer: user.isFollowedByViewer ?? false,
  };
}

function mapCommunityPost(post: RawCommunityPost, member: CommunityMember): CommunityPostData {
  const width = post.featuredImage?.node.mediaDetails?.width || 4;
  const height = post.featuredImage?.node.mediaDetails?.height || 5;
  return {
    id: String(post.databaseId),
    href: post.uri || `/community/post/${post.databaseId}`,
    databaseId: post.databaseId,
    image: post.featuredImage?.node.sourceUrl || "",
    aspect: `${width}/${height}`,
    caption: stripHtml(post.content || ""),
    contentHtml: post.content || "",
    tags: post.communityTags.nodes.flatMap(({ name }) => name ? [name] : []),
    likes: post.likesCount,
    comments: post.comments.nodes.length,
    createdAt: post.date || new Date(0).toISOString(),
    likedByViewer: post.likedByViewer,
    ratingAverage: post.ratingAverage ?? undefined,
    author: {
      handle: member.handle,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
    },
    reviews: post.comments.nodes.map(mapComment),
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
  };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
