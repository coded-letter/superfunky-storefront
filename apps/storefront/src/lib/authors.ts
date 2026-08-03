import type { PostCardData } from "@funky/ui";
import { BLOG_POST_CARD_FIELDS, mapBlogPost, type RawBlogPost } from "./postArchives";
import { graphqlRequest } from "./graphqlClient";

export type CmsAuthorArchive = {
  id: string;
  databaseId: number;
  slug: string;
  uri: string | null;
  name: string;
  bio: string;
  avatarUrl: string | null;
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
    }
    posts(first: 100, where: { authorName: $authorName, language: $language }) {
      ${BLOG_POST_CARD_FIELDS}
    }
  }
`;

export async function getAuthorArchive(slug: string, languageCode: string): Promise<CmsAuthorArchive | null> {
  const { data, errors } = await graphqlRequest<AuthorArchiveResult>(AUTHOR_ARCHIVE_QUERY, {
    slug,
    authorName: slug,
    language: languageCode,
  });

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
    languageCode: languageCode.toLowerCase(),
    posts: data.posts?.nodes.map(mapBlogPost) || [],
  };
}
