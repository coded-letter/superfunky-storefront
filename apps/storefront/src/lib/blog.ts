import type { PostCardData } from "@funky/ui";
import {
  graphqlRequest,
  STOREFRONT_BACKEND_PROFILE,
  type GraphqlResponse,
} from "@funky/sdk";
import { requestGraphqlWithCompatibility } from "./graphqlFieldFallback";
import { BLOG_DATA_COMPATIBILITY_RULES } from "./blogGraphqlCompatibility";
import {
  BLOG_POST_CARD_FIELDS,
  mapBlogPost,
  type RawBlogPost,
  type RawBlogTerm,
} from "./postArchives";
import {
  createCoreBlogQuery,
  shouldPreferCoreGraphqlQueries,
} from "./profileGraphqlCompatibility";

export type CmsBlogTerm = {
  id: string;
  name: string;
  slug: string;
  uri: string;
  count: number;
  description: string;
};

export type CmsBlogAuthor = {
  id: string;
  name: string;
  slug: string;
  uri: string | null;
  bio: string;
  avatarUrl: string | null;
  postCount: number;
};

export type CmsBlogComment = {
  id: string;
  author: string;
  content: string;
  date: string;
  rating?: number;
  postTitle: string;
  postUri: string;
};

export type CmsBlogData = {
  posts: PostCardData[];
  categories: CmsBlogTerm[];
  tags: CmsBlogTerm[];
  authors: CmsBlogAuthor[];
  comments: CmsBlogComment[];
  hasMorePosts: boolean;
};

type RawBlogListingTerm = RawBlogTerm & {
  count: number | null;
  description: string | null;
};

type BlogDataResult = {
  posts: {
    nodes: RawBlogPost[];
    pageInfo: { hasNextPage: boolean };
  } | null;
  categories: { nodes: RawBlogListingTerm[] } | null;
  tags: { nodes: RawBlogListingTerm[] } | null;
  comments: {
    nodes: {
      id: string;
      content: string | null;
      date: string | null;
      rating: number | null;
      author: { node: { name: string | null } } | null;
      commentedOn: {
        node: {
          title: string | null;
          uri: string | null;
          language: { code: string | null } | null;
        } | null;
      } | null;
    }[];
  } | null;
};

type BlogAuthorDirectoryResult = {
  posts: {
    nodes: RawBlogPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  } | null;
};

const BLOG_DATA_QUERY = /* GraphQL */ `
  query StorefrontBlogData($language: LanguageCodeFilterEnum!) {
    posts(first: 100, where: { language: $language }) {
      ${BLOG_POST_CARD_FIELDS}
    }
    categories(first: 100, where: { hideEmpty: true, language: $language, orderby: COUNT, order: DESC }) {
      nodes {
        id
        name
        slug
        uri
        count
        description
        language {
          code
        }
      }
    }
    tags(first: 100, where: { hideEmpty: true, language: $language, orderby: COUNT, order: DESC }) {
      nodes {
        id
        name
        slug
        uri
        count
        description
        language {
          code
        }
      }
    }
    comments(
      first: 20
      where: {
        contentType: [POST]
        parent: 0
        statusIn: [APPROVE]
        orderby: COMMENT_DATE
        order: DESC
      }
    ) {
      nodes {
        id
        content(format: RENDERED)
        date
        rating
        author {
          node {
            name
          }
        }
        commentedOn {
          node {
            ... on Post {
              title
              uri
              language {
                code
              }
            }
          }
        }
      }
    }
  }
`;

const BLOG_AUTHOR_DIRECTORY_QUERY = /* GraphQL */ `
  query StorefrontBlogAuthorDirectory($language: LanguageCodeFilterEnum!, $after: String) {
    posts(first: 100, after: $after, where: { language: $language }) {
      nodes {
        id
        author {
          node {
            id
            databaseId
            name
            slug
            uri
            description
            avatar(size: 192) {
              url
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export async function getBlogData(languageCode: string, backendLanguageCode: string): Promise<CmsBlogData> {
  const query = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE)
    ? createCoreBlogQuery(BLOG_DATA_QUERY)
    : BLOG_DATA_QUERY;
  const { data, errors } = await requestGraphqlWithCompatibility<BlogDataResult>(
    graphqlRequest,
    query,
    { language: backendLanguageCode },
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }

  if (!data) {
    throw new Error("The blog data query returned no data");
  }

  const posts = data.posts?.nodes.map(mapBlogPost) || [];
  return {
    posts,
    categories: mapListingTerms(data.categories?.nodes),
    tags: mapListingTerms(data.tags?.nodes),
    authors: mapAuthors(data.posts?.nodes),
    comments:
      data.comments?.nodes.flatMap((comment) => {
        const post = comment.commentedOn?.node;
        if (
          !post?.title
          || !post.uri
          || (
            post.language?.code
            && post.language.code.toLowerCase() !== languageCode.toLowerCase()
          )
        ) return [];
        return [{
          id: comment.id,
          author: comment.author?.node?.name?.trim() || "Anonymous",
          content: htmlToText(comment.content || ""),
          date: comment.date || "",
          rating: comment.rating && comment.rating >= 1 && comment.rating <= 5 ? comment.rating : undefined,
          postTitle: post.title,
          postUri: post.uri,
        }];
      }).slice(0, 4) || [],
    hasMorePosts: data.posts?.pageInfo.hasNextPage || false,
  };
}

export async function getBlogAuthorDirectory(languageCode: string): Promise<CmsBlogAuthor[]> {
  const posts: RawBlogPost[] = [];
  let after: string | null = null;

  do {
    const query = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE)
      ? createCoreBlogQuery(BLOG_AUTHOR_DIRECTORY_QUERY)
      : BLOG_AUTHOR_DIRECTORY_QUERY;
    const response: GraphqlResponse<BlogAuthorDirectoryResult> = await requestGraphqlWithCompatibility<BlogAuthorDirectoryResult>(
      graphqlRequest,
      query,
      { language: languageCode, after },
      BLOG_DATA_COMPATIBILITY_RULES,
    );
    const pageData: BlogAuthorDirectoryResult | null = response.data;
    const errors = response.errors;
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    if (!pageData?.posts) throw new Error("The blog author directory query returned no data");

    posts.push(...pageData.posts.nodes);
    if (!pageData.posts.pageInfo.hasNextPage) break;
    if (!pageData.posts.pageInfo.endCursor) {
      throw new Error("The blog author directory query returned an incomplete pagination cursor");
    }
    after = pageData.posts.pageInfo.endCursor;
  } while (after);

  return mapAuthors(posts);
}

function mapListingTerms(terms: RawBlogListingTerm[] | undefined): CmsBlogTerm[] {
  const mapped = new Map<string, CmsBlogTerm>();
  terms?.forEach((term) => {
    if (!term.name || !term.slug || !term.uri) return;
    mapped.set(term.name.trim().toLocaleLowerCase(), {
      id: term.id,
      name: term.name,
      slug: term.slug,
      uri: term.uri,
      count: term.count || 0,
      description: htmlToText(term.description || ""),
    });
  });
  return [...mapped.values()];
}

function mapAuthors(posts: RawBlogPost[] | undefined): CmsBlogAuthor[] {
  const authors = new Map<string, CmsBlogAuthor>();
  posts?.forEach((post) => {
    const author = post.author?.node;
    if (!author) return;
    const existing = authors.get(author.id);
    if (existing) {
      existing.postCount += 1;
      return;
    }
    authors.set(author.id, {
      id: author.id,
      name: author.name?.trim() || "Unknown author",
      slug: author.slug || "",
      uri: author.uri,
      bio: author.description?.trim() || "",
      avatarUrl: author.avatar?.url || null,
      postCount: 1,
    });
  });
  return [...authors.values()].sort((left, right) => right.postCount - left.postCount);
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}
