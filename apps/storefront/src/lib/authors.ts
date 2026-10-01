import type { PostCardData } from "@funky/ui";
import { BLOG_POST_CARD_FIELDS, mapBlogPost, type RawBlogPost } from "./postArchives.ts";
import { graphqlRequest, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import {
  AUTHOR_ARCHIVE_COMPATIBILITY_RULE,
  createCompatibleAuthorArchiveQuery,
} from "./authorArchiveGraphqlCompatibility.ts";
import { missingGraphqlFieldRule, requestGraphqlWithCompatibility } from "./graphqlFieldFallback.ts";
import { shouldPreferCoreContentQueries } from "./profileGraphqlCompatibility.ts";
import { ARCHIVE_BATCH_SIZE, fetchArchiveNodesInBatches } from "./archiveSettings.ts";

export type CmsAuthorArchive = {
  id: string;
  databaseId: number;
  slug: string;
  uri: string | null;
  name: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  languageCode: string;
  posts: PostCardData[];
};

type AuthorArchiveResult = {
  user: {
    id: string;
    databaseId: number;
    slug: string | null;
    uri: string | null;
    name: string | null;
    description: string | null;
    storefrontDescription?: string | null;
    avatar: { url: string | null } | null;
    communityCover: { url: string | null } | null;
  } | null;
  posts: { nodes: RawBlogPost[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } } | null;
};

const AUTHOR_ARCHIVE_QUERY = /* GraphQL */ `
  query StorefrontAuthorArchive(
    $slug: ID!
    $authorName: String!
    $language: LanguageCodeFilterEnum!
    $first: Int!
    $after: String
  ) {
    user(id: $slug, idType: SLUG) {
      id
      databaseId
      slug
      uri
      name
      description
      storefrontDescription(language: $language)
      avatar(size: 192) {
        url
      }
      communityCover {
        url
      }
    }
    posts(first: $first, after: $after, where: { authorName: $authorName, language: $language }) {
      ${BLOG_POST_CARD_FIELDS}
    }
  }
`;

export async function getAuthorArchive(
  slug: string,
  backendLanguageCode: string,
  languageCode = backendLanguageCode,
  configuredLanguageCodes: readonly string[] = [],
): Promise<CmsAuthorArchive | null> {
  const normalizedRequestedLanguageCode = languageCode.toLowerCase();
  const query = shouldPreferCoreContentQueries(STOREFRONT_BACKEND_PROFILE)
    ? createCompatibleAuthorArchiveQuery(AUTHOR_ARCHIVE_QUERY)
    : AUTHOR_ARCHIVE_QUERY;
  const { data, errors } = await requestGraphqlWithCompatibility<AuthorArchiveResult>(
    graphqlRequest,
    query,
    {
      slug,
      authorName: slug,
      language: backendLanguageCode,
      first: ARCHIVE_BATCH_SIZE,
      after: null,
    },
    [missingGraphqlFieldRule("storefrontDescription"), AUTHOR_ARCHIVE_COMPATIBILITY_RULE],
  );

  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The author archive query returned no data");
  if (!data.user) return null;

  let firstPage: AuthorArchiveResult | null = data;
  const { nodes } = await fetchArchiveNodesInBatches<RawBlogPost>(-1, async (first, after) => {
    let page = firstPage;
    firstPage = null;
    if (!page) {
      const result = await requestGraphqlWithCompatibility<AuthorArchiveResult>(
        graphqlRequest,
        query,
        { slug, authorName: slug, language: backendLanguageCode, first, after },
        [missingGraphqlFieldRule("storefrontDescription"), AUTHOR_ARCHIVE_COMPATIBILITY_RULE],
      );
      if (result.errors?.length) throw new Error(result.errors.map(({ message }) => message).join("; "));
      if (!result.data) throw new Error("The author pagination query returned no data");
      page = result.data;
    }
    return page.posts || { nodes: [], pageInfo: { hasNextPage: false } };
  });

  return {
    id: data.user.id,
    databaseId: data.user.databaseId,
    slug: data.user.slug || slug,
    uri: data.user.uri,
    name: data.user.name?.trim() || "Unknown author",
    bio: data.user.storefrontDescription?.trim() || data.user.description?.trim() || "",
    avatarUrl: data.user.avatar?.url || null,
    // Reuses the canonical `_community_cover_attachment_id` user meta (via the
    // existing `communityCover` field) so authors and community members share one
    // cover image — no separate journal-only cover field.
    coverUrl: data.user.communityCover?.url || null,
    languageCode: normalizedRequestedLanguageCode,
    posts: nodes
      .filter((post) => post.author?.node.slug === (data.user?.slug || slug))
      .filter((post) => matchesAuthorPostLanguage(post, normalizedRequestedLanguageCode, configuredLanguageCodes))
      .map(mapBlogPost),
  };
}

export function matchesAuthorPostLanguage(
  post: Pick<RawBlogPost, "language" | "uri">,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): boolean {
  const requestedLanguage = languageCode.toLowerCase();
  const postLanguage = post.language?.code?.toLowerCase();
  if (postLanguage) return postLanguage === requestedLanguage;

  const configured = [...new Set(configuredLanguageCodes.map((code) => code.toLowerCase()).filter(Boolean))];
  if (configured.length < 2) return true;
  const prefix = post.uri?.split(/[?#]/, 1)[0].split("/").filter(Boolean)[0]?.toLowerCase() || "";
  return requestedLanguage === configured[0]
    ? !configured.slice(1).includes(prefix)
    : prefix === requestedLanguage;
}
