import type { ProductReview } from "../pages/shared.tsx";
import {
  graphqlRequest,
  STOREFRONT_BACKEND_PROFILE,
  STOREFRONT_DEFAULT_LANGUAGE,
  STOREFRONT_EXPECTED_LOCALES,
} from "@funky/sdk";
import { resolvePathLanguageCode } from "@funky/ui/src/locale/urlPaths.ts";
import {
  missingGraphqlFieldRule,
  requestGraphqlWithCompatibility,
  unsupportedRenderedFormatRule,
} from "./graphqlFieldFallback.ts";
import {
  mapScript,
  mapSeo,
  emptyThemeStyles,
  type CmsPageScript,
  type CmsPageSeo,
  type CmsPublicRobots,
  type CmsPageTranslation,
  type RawCmsScript,
  type RawCmsSeo,
  type CmsThemeStyles,
  THEME_STYLES_FIELDS,
} from "./pages.ts";
import { normalizeFeaturedImage, type CmsFeaturedImage, type RawFeaturedImage } from "@funky/cms";
import { mapPublicEngagementRating, type PublicEngagementRatingSummary } from "./engagementRatings.ts";
import { POST_GRAPHQL_COMPATIBILITY_RULES } from "./postGraphqlCompatibility.ts";
import {
  createProfilePostQuery,
} from "./profileGraphqlCompatibility.ts";
import { requestPostWithSlugFallback } from "./postLookup.ts";
import { storefrontPostPath } from "./postRoutePaths.mjs";

export type CmsPostTerm = {
  id: string;
  name: string;
  slug: string;
  uri: string;
};

export type CmsPost = {
  id: string;
  databaseId: number;
  slug: string;
  uri: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  modified: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  languageCode: string;
  translations: CmsPageTranslation[];
  author: {
    id: string;
    name: string;
    bio: string;
    uri: string | null;
    avatarUrl: string | null;
  };
  categories: CmsPostTerm[];
  tags: CmsPostTerm[];
  featuredImage: CmsFeaturedImage | null;
  engagementRating: PublicEngagementRatingSummary;
  comments: ProductReview[];
  seo: CmsPageSeo;
  scripts: CmsPageScript[];
  themeStyles: CmsThemeStyles;
};

type RawPostTerm = {
  id: string;
  name: string | null;
  slug: string | null;
  uri: string | null;
  language: { code: string | null } | null;
};

type PostByUriResult = {
  post: {
    id: string;
    databaseId: number;
    slug: string | null;
    uri: string | null;
    title: string | null;
    content?: string | null;
    headlessContent?: string | null;
    excerpt: string | null;
    date: string | null;
    modified: string | null;
    language: { code: string | null } | null;
    translations: ({ databaseId: number; uri: string | null; language: { code: string | null } | null } | null)[] | null;
    author: {
      node: {
        id: string;
        name: string | null;
        description: string | null;
        uri: string | null;
        avatar: { url: string | null } | null;
      };
    } | null;
    categories: { nodes: RawPostTerm[] } | null;
    tags: { nodes: RawPostTerm[] } | null;
    featuredImage: RawFeaturedImage;
    engagementRating: PublicEngagementRatingSummary;
    comments: {
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
    enqueuedScripts: { nodes: RawCmsScript[] } | null;
    seo: RawCmsSeo | null;
    funkycommercePublicRobots?: CmsPublicRobots | null;
    themeStyles?: CmsThemeStyles | null;
  } | null;
};

const POST_RENDERED_CONTENT_FIELDS = `      content(format: RENDERED)
      headlessContent`;

const POST_BY_URI_QUERY = /* GraphQL */ `
  query StorefrontPostByUri($uri: ID!) {
    post(id: $uri, idType: URI) {
      id
      databaseId
      slug
      uri
      language {
        code
      }
      title
${POST_RENDERED_CONTENT_FIELDS}
      excerpt(format: RENDERED)
      date
      modified
      engagementRating {
        average
        count
        guestCount
        authoredCount
        histogram
      }
      translations {
        databaseId
        uri
        language {
          code
        }
      }
      author {
        node {
          id
          name
          description
          uri
          avatar(size: 192) {
            url
          }
        }
      }
      categories {
        nodes {
          id
          name
          slug
          uri
          language {
            code
          }
        }
      }
      tags {
        nodes {
          id
          name
          slug
          uri
          language {
            code
          }
        }
      }
      featuredImage {
        node {
          sourceUrl
          altText
          srcSet
          mediaDetails {
            width
            height
          }
        }
      }
      comments(first: 100, where: { statusIn: [APPROVE] }) {
        nodes {
          id
          databaseId
          content
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
      enqueuedScripts(first: 100) {
        nodes {
          id
          handle
          src
          strategy
          groupLocation
          before
          after
          dependencies {
            id
            handle
            src
            strategy
            groupLocation
            before
            after
            dependencies {
              id
              handle
              src
              strategy
              groupLocation
              before
              after
            }
          }
        }
      }
      seo {
        breadcrumbs {
          text
          url
        }
        canonical
        metaDesc
        metaKeywords
        metaRobotsNofollow
        metaRobotsNoindex
        opengraphAuthor
        opengraphDescription
        opengraphImage {
          sourceUrl
        }
        opengraphModifiedTime
        opengraphPublishedTime
        opengraphPublisher
        opengraphSiteName
        opengraphTitle
        opengraphType
        opengraphUrl
        readingTime
        schema {
          articleType
          pageType
          raw
        }
        title
        twitterDescription
        twitterTitle
      }
      funkycommercePublicRobots { noindex nofollow }
      themeStyles {
        ${THEME_STYLES_FIELDS}
      }
    }
  }
`;

const POST_BY_SLUG_QUERY = POST_BY_URI_QUERY
  .replace("StorefrontPostByUri", "StorefrontPostBySlug")
  .replace("idType: URI", "idType: SLUG");

const POST_COMPATIBILITY_RULES = [
  ...POST_GRAPHQL_COMPATIBILITY_RULES,
  missingGraphqlFieldRule("headlessContent"),
  missingGraphqlFieldRule("themeStyles"),
  missingGraphqlFieldRule("enqueuedScripts"),
  missingGraphqlFieldRule("engagementRating"),
  missingGraphqlFieldRule("rating"),
  missingGraphqlFieldRule("language"),
  missingGraphqlFieldRule("translations"),
  missingGraphqlFieldRule("seo"),
  missingGraphqlFieldRule("funkycommercePublicRobots"),
  unsupportedRenderedFormatRule,
] as const;

const POST_COMMENTS_QUERY = /* GraphQL */ `
  query StorefrontPostComments($id: ID!, $after: String) {
    post(id: $id, idType: DATABASE_ID) {
      comments(first: 100, after: $after, where: { statusIn: [APPROVE] }) {
        nodes {
          id
          databaseId
          content
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
`;

export async function getPostByUri(
  uri: string,
  renderedContent?: (id: string) => { content: string | null; headlessContent?: string | null },
  requestTimeoutMs?: number,
): Promise<CmsPost | null> {
  const requestPostGraphql = <T>(
    query: string,
    variables?: Record<string, unknown>,
  ) => graphqlRequest<T>(query, variables, undefined, requestTimeoutMs);
  const response = await requestPostWithSlugFallback(
    uri,
    (identifier, idType) => {
      const sourceQuery = idType === "URI" ? POST_BY_URI_QUERY : POST_BY_SLUG_QUERY;
      const query = createProfilePostQuery(
        renderedContent ? sourceQuery.replace(POST_RENDERED_CONTENT_FIELDS, "") : sourceQuery,
        STOREFRONT_BACKEND_PROFILE,
      );
      return requestGraphqlWithCompatibility<PostByUriResult>(
        requestPostGraphql,
        query,
        { uri: identifier },
        POST_COMPATIBILITY_RULES,
      );
    },
    (result) => !result.errors?.length && result.data?.post === null,
  );
  const { data, errors } = response;

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The post query returned no data");
  }
  if (!data.post) {
    return null;
  }

  return mapPostDetail(data.post, uri, renderedContent);
}

export async function getPostsByUris(
  uris: readonly string[],
  renderedContent: (id: string) => { content: string | null; headlessContent?: string | null },
): Promise<Map<string, CmsPost>> {
  const results = new Map<string, CmsPost>();
  const uniqueUris = [...new Set(uris)];
  const source = createProfilePostQuery(
    POST_BY_URI_QUERY.replace(POST_RENDERED_CONTENT_FIELDS, ""),
    STOREFRONT_BACKEND_PROFILE,
  );
  const selection = source.slice(source.indexOf("{") + 1, source.lastIndexOf("}"));

  // Two detail selections amortize WordPress startup without a large render query.
  for (let offset = 0; offset < uniqueUris.length; offset += 2) {
    const batch = uniqueUris.slice(offset, offset + 2);
    const query = `query StorefrontBuildPostDetails(${batch.map((_, index) => `$uri${index}: ID!`).join(", ")}) {
      ${batch.map((_, index) => selection
        .replace(/\bpost\(id:/, `post${index}: post(id:`)
        .replace(/\$uri\b/g, `$uri${index}`)).join("\n")}
    }`;
    const { data, errors } = await requestGraphqlWithCompatibility<Record<string, PostByUriResult["post"]>>(
      graphqlRequest,
      query,
      Object.fromEntries(batch.map((uri, index) => [`uri${index}`, uri])),
      POST_COMPATIBILITY_RULES,
    );
    if (errors?.length) {
      throw new Error(`Post detail batch ${batch.join(", ")} failed: ${errors.map(({ message }) => message).join("; ")}`);
    }
    if (!data) throw new Error(`Post detail batch ${batch.join(", ")} returned no data`);

    for (const [index, uri] of batch.entries()) {
      const key = `post${index}`;
      if (!Object.prototype.hasOwnProperty.call(data, key)) throw new Error(`Post detail batch omitted ${uri}`);
      const post = data[key]
        ? await mapPostDetail(data[key], uri, renderedContent)
        : await getPostByUri(uri, renderedContent);
      if (!post) throw new Error(`No post data returned for discovered route ${uri}`);
      results.set(uri, post);
    }
  }
  return results;
}

async function mapPostDetail(
  rawPost: NonNullable<PostByUriResult["post"]>,
  uri: string,
  renderedContent?: (id: string) => { content: string | null; headlessContent?: string | null },
): Promise<CmsPost> {
  const post = await loadRemainingPostComments(
    renderedContent ? { ...rawPost, ...renderedContent(rawPost.id) } : rawPost,
  );
  const author = post.author?.node;
  const contentText = htmlToText(post.content || "");
  const wordCount = contentText ? contentText.split(/\s+/).length : 0;
  const readingTime = post.seo?.readingTime;
  const languageCode = post.language?.code?.toLowerCase() || resolveContentLanguage(post.uri || uri);
  const storefrontUri = storefrontPostPath({
    uri: post.uri || uri,
    slug: post.slug,
    languageCode,
    defaultLanguage: STOREFRONT_DEFAULT_LANGUAGE,
    configuredLanguageCodes: STOREFRONT_EXPECTED_LOCALES,
  });
  const seo = mapSeo(post.seo, post.funkycommercePublicRobots);

  return {
    id: post.id,
    databaseId: post.databaseId,
    slug: post.slug || "",
    uri: storefrontUri,
    title: post.title?.trim() || "Untitled post",
    content: post.headlessContent || post.content || "",
    excerpt: htmlToText(post.excerpt || ""),
    date: post.date || "",
    modified: post.modified,
    wordCount,
    readingTimeMinutes: readingTime && readingTime > 0 ? Math.ceil(readingTime) : Math.max(1, Math.ceil(wordCount / 200)),
    languageCode,
    translations:
      post.translations?.flatMap((translation) =>
        translation?.uri
          ? [{
              databaseId: translation.databaseId,
              uri: storefrontPostPath({
                uri: translation.uri,
                languageCode: translation.language?.code,
                defaultLanguage: STOREFRONT_DEFAULT_LANGUAGE,
                configuredLanguageCodes: STOREFRONT_EXPECTED_LOCALES,
              }),
              languageCode: translation.language?.code?.toLowerCase() || resolveContentLanguage(translation.uri),
            }]
          : [],
      ) || [],
    author: {
      id: author?.id || "unknown",
      name: author?.name?.trim() || "Unknown author",
      bio: author?.description?.trim() || "",
      uri: author?.uri || null,
      avatarUrl: author?.avatar?.url || null,
    },
    categories: mapTerms(post.categories?.nodes, post.language?.code),
    tags: mapTerms(post.tags?.nodes, post.language?.code),
    featuredImage: normalizeFeaturedImage(post.featuredImage, post.seo?.schema),
    engagementRating: mapPublicEngagementRating(post.engagementRating),
    comments:
      post.comments?.nodes.map((comment) => ({
        id: comment.id,
        databaseId: comment.databaseId,
        author: comment.author?.node?.name?.trim() || "Anonymous",
        date: comment.date || "",
        content: htmlToText(comment.content || ""),
        parentId: comment.parentId,
        parentDatabaseId: comment.parentDatabaseId,
        rating: normalizeRating(comment.rating),
      })) || [],
    seo: {
      ...seo,
      canonical: storefrontUri,
      opengraphUrl: storefrontUri,
    },
    scripts: post.enqueuedScripts?.nodes.map(mapScript) || [],
    themeStyles: post.themeStyles || emptyThemeStyles(),
  };
}

function resolveContentLanguage(uri: string): string {
  return resolvePathLanguageCode(
    uri,
    STOREFRONT_EXPECTED_LOCALES,
    STOREFRONT_DEFAULT_LANGUAGE,
    STOREFRONT_BACKEND_PROFILE === "blog",
  );
}

async function loadRemainingPostComments(
  post: NonNullable<PostByUriResult["post"]>,
): Promise<NonNullable<PostByUriResult["post"]>> {
  if (!post.comments) return post;

  const comments = [...post.comments.nodes];
  let pageInfo = post.comments.pageInfo;

  while (pageInfo.hasNextPage) {
    if (!pageInfo.endCursor) {
      throw new Error("The post discussion query returned an incomplete pagination cursor");
    }
    const { data, errors } = await graphqlRequest<{
      post: Pick<NonNullable<PostByUriResult["post"]>, "comments"> | null;
    }>(POST_COMMENTS_QUERY, {
      id: String(post.databaseId),
      after: pageInfo.endCursor,
    });
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    if (!data?.post?.comments) {
      throw new Error("The post discussion pagination query returned no post");
    }

    comments.push(...data.post.comments.nodes);
    pageInfo = data.post.comments.pageInfo;
  }

  return {
    ...post,
    comments: {
      nodes: comments,
      pageInfo,
    },
  };
}

function mapTerms(terms: RawPostTerm[] | undefined, postLanguage?: string | null): CmsPostTerm[] {
  const mapped = new Map<string, CmsPostTerm>();
  terms?.forEach((term) => {
    if (!term.name || !term.slug || !term.uri) return;
    if (postLanguage && term.language?.code && term.language.code !== postLanguage) return;
    mapped.set(term.name.trim().toLocaleLowerCase(), {
      id: term.id,
      name: term.name,
      slug: term.slug,
      uri: term.uri,
    });
  });
  return [...mapped.values()];
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}

function normalizeRating(rating: number | null): number | undefined {
  return rating && rating >= 1 && rating <= 5 ? rating : undefined;
}
