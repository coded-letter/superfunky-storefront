import type { ProductReview } from "../pages/shared";
import { graphqlRequest } from "./graphqlClient";
import {
  mapScript,
  mapSeo,
  type CmsPageScript,
  type CmsPageSeo,
  type CmsPageTranslation,
  type RawCmsScript,
  type RawCmsSeo,
  type CmsThemeStyles,
  THEME_STYLES_FIELDS,
} from "./pages";

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
  featuredImage: { sourceUrl: string; altText: string } | null;
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
    content: string | null;
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
    featuredImage: { node: { sourceUrl: string | null; altText: string | null } } | null;
    comments: {
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
    enqueuedScripts: { nodes: RawCmsScript[] } | null;
    seo: RawCmsSeo | null;
    themeStyles: CmsThemeStyles;
  } | null;
};

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
      content(format: RENDERED)
      excerpt(format: RENDERED)
      date
      modified
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
        }
      }
      comments(first: 100) {
        nodes {
          id
          databaseId
          content
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
        opengraphSiteName
        opengraphTitle
        opengraphType
        opengraphUrl
        readingTime
        schema {
          articleType
          pageType
        }
        title
        twitterDescription
        twitterTitle
      }
      themeStyles {
        ${THEME_STYLES_FIELDS}
      }
    }
  }
`;

export async function getPostByUri(uri: string): Promise<CmsPost | null> {
  const { data, errors } = await graphqlRequest<PostByUriResult>(POST_BY_URI_QUERY, { uri });

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The post query returned no data");
  }
  if (!data.post) {
    return null;
  }

  const { post } = data;
  const author = post.author?.node;
  const contentText = htmlToText(post.content || "");
  const wordCount = contentText ? contentText.split(/\s+/).length : 0;
  const readingTime = post.seo?.readingTime;

  return {
    id: post.id,
    databaseId: post.databaseId,
    slug: post.slug || "",
    uri: post.uri || uri,
    title: post.title?.trim() || "Untitled post",
    content: post.content || "",
    excerpt: htmlToText(post.excerpt || ""),
    date: post.date || "",
    modified: post.modified,
    wordCount,
    readingTimeMinutes: readingTime && readingTime > 0 ? Math.ceil(readingTime) : Math.max(1, Math.ceil(wordCount / 200)),
    languageCode: post.language?.code?.toLowerCase() || "en",
    translations:
      post.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language.code.toLowerCase(),
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
    featuredImage: post.featuredImage?.node.sourceUrl
      ? {
          sourceUrl: post.featuredImage.node.sourceUrl,
          altText: post.featuredImage.node.altText || "",
        }
      : null,
    comments:
      post.comments?.nodes.map((comment) => ({
        id: comment.id,
        databaseId: comment.databaseId,
        author: comment.author?.node?.name?.trim() || "Anonymous",
        date: comment.date || "",
        content: htmlToText(comment.content || ""),
        parentId: comment.parentId,
        rating: normalizeRating(comment.rating),
      })) || [],
    seo: mapSeo(post.seo),
    scripts: post.enqueuedScripts?.nodes.map(mapScript) || [],
    themeStyles: post.themeStyles,
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
