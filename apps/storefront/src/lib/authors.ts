import type { PostCardData } from "@funky/ui";
import { BLOG_POST_CARD_FIELDS, mapBlogPost, type RawBlogPost } from "./postArchives";
import { graphqlRequest, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import {
  AUTHOR_ARCHIVE_COMPATIBILITY_RULE,
  createCompatibleAuthorArchiveQuery,
} from "./authorArchiveGraphqlCompatibility";
import { requestGraphqlWithCompatibility } from "./graphqlFieldFallback";
import { shouldPreferCoreContentQueries } from "./profileGraphqlCompatibility";

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
    avatar: { url: string | null } | null;
    communityCover: { url: string | null } | null;
  } | null;
  posts: { nodes: RawBlogPost[] } | null;
};

const AUTHOR_ARCHIVE_QUERY = /* GraphQL */ `
  query StorefrontAuthorArchive(
    $slug: ID!
    $authorName: String!
    $language: LanguageCodeFilterEnum!
  ) {
    user(id: $slug, idType: SLUG) {
      id
      databaseId
      slug
      uri
      name
      description
      avatar(size: 192) {
        url
      }
      communityCover {
        url
      }
    }
    posts(first: 100, where: { authorName: $authorName, language: $language }) {
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
    },
    [AUTHOR_ARCHIVE_COMPATIBILITY_RULE],
  );

  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The author archive query returned no data");
  if (!data.user) return null;

  return {
    id: data.user.id,
    databaseId: data.user.databaseId,
    slug: data.user.slug || slug,
    uri: data.user.uri,
    name: data.user.name?.trim() || "Unknown author",
    bio: data.user.description?.trim() || "",
    avatarUrl: data.user.avatar?.url || null,
    // Reuses the canonical `_community_cover_attachment_id` user meta (via the
    // existing `communityCover` field) so authors and community members share one
    // cover image — no separate journal-only cover field.
    coverUrl: data.user.communityCover?.url || null,
    languageCode: normalizedRequestedLanguageCode,
    posts: data.posts?.nodes
      .filter((post) => post.author?.node.slug === (data.user?.slug || slug))
      .filter((post) => matchesAuthorPostLanguage(post, normalizedRequestedLanguageCode, configuredLanguageCodes))
      .map(mapBlogPost) || [],
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
