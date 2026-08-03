import type { PostCardData } from "@funky/ui";
import { graphqlRequest } from "./graphqlClient";
import {
  mapScript,
  mapSeo,
  type CmsPageScript,
  type CmsPageSeo,
  type CmsPageTranslation,
  type RawCmsScript,
  type RawCmsSeo,
} from "./pages";

export type PostTaxonomy = "category" | "tag";
export type TaxonomyIdentifierType = "URI" | "SLUG";

export type CmsTaxonomyTerm = {
  id: string;
  name: string;
  slug: string;
  uri: string;
};

export type CmsPostArchive = {
  id: string;
  databaseId: number;
  taxonomy: PostTaxonomy;
  name: string;
  slug: string;
  uri: string;
  descriptionHtml: string;
  languageCode: string;
  translations: CmsPageTranslation[];
  posts: PostCardData[];
  hasMorePosts: boolean;
  terms: CmsTaxonomyTerm[];
  seo: CmsPageSeo;
  scripts: CmsPageScript[];
};

export type RawBlogTerm = {
  id: string;
  name: string | null;
  slug: string | null;
  uri: string | null;
  language: { code: string | null } | null;
};

export type RawBlogPost = {
  id: string;
  databaseId: number;
  slug: string | null;
  uri: string | null;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  date: string | null;
  modified: string | null;
  language: { code: string | null } | null;
  translations: ({ id: string; language: { code: string | null } | null } | null)[] | null;
  author: {
    node: {
      id: string;
      databaseId: number;
      name: string | null;
      slug: string | null;
      uri: string | null;
      description: string | null;
      avatar: { url: string | null } | null;
    };
  } | null;
  featuredImage: { node: { sourceUrl: string | null } } | null;
  categories: { nodes: RawBlogTerm[] } | null;
  tags: { nodes: RawBlogTerm[] } | null;
  seo: { readingTime: number | null } | null;
};

type RawTaxonomySeo = Omit<RawCmsSeo, "schema"> & {
  schema: { raw: string | null } | null;
};

type RawTaxonomyArchive = {
  id: string;
  databaseId: number;
  name: string | null;
  slug: string | null;
  uri: string | null;
  description: string | null;
  language: { code: string | null } | null;
  translations: ({ databaseId: number; uri: string | null; language: { code: string | null } | null } | null)[] | null;
  posts: {
    nodes: RawBlogPost[];
    pageInfo: { hasNextPage: boolean };
  } | null;
  enqueuedScripts: { nodes: RawCmsScript[] } | null;
  seo: RawTaxonomySeo | null;
};

type TaxonomyArchiveResult = {
  archive: RawTaxonomyArchive | null;
  terms: { nodes: RawBlogTerm[] } | null;
};

export const BLOG_POST_CARD_FIELDS = /* GraphQL */ `
  nodes {
    id
    databaseId
    slug
    uri
    title
    excerpt(format: RENDERED)
    content(format: RENDERED)
    date
    modified
    language {
      code
    }
    translations {
      id
      language {
        code
      }
    }
    author {
      node {
        id
        databaseId
        name
        slug
        uri
        description
        avatar(size: 96) {
          url
        }
      }
    }
    featuredImage {
      node {
        sourceUrl
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
    seo {
      readingTime
    }
  }
  pageInfo {
    hasNextPage
  }
`;

const SCRIPT_FIELDS = /* GraphQL */ `
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
`;

const TAXONOMY_SEO_FIELDS = /* GraphQL */ `
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
  schema {
    raw
  }
  title
  twitterDescription
  twitterTitle
`;

const TERM_FIELDS = /* GraphQL */ `
  nodes {
    id
    name
    slug
    uri
    language {
      code
    }
  }
`;

const CATEGORY_ARCHIVE_QUERY = /* GraphQL */ `
  query StorefrontCategoryArchive($id: ID!, $idType: CategoryIdType!) {
    archive: category(id: $id, idType: $idType) {
      id
      databaseId
      name
      slug
      uri
      description
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
      posts(first: 100) {
        ${BLOG_POST_CARD_FIELDS}
      }
      enqueuedScripts(first: 100) {
        ${SCRIPT_FIELDS}
      }
      seo {
        ${TAXONOMY_SEO_FIELDS}
      }
    }
    terms: categories(first: 100, where: { hideEmpty: true, language: ALL }) {
      ${TERM_FIELDS}
    }
  }
`;

const TAG_ARCHIVE_QUERY = /* GraphQL */ `
  query StorefrontTagArchive($id: ID!, $idType: TagIdType!) {
    archive: tag(id: $id, idType: $idType) {
      id
      databaseId
      name
      slug
      uri
      description
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
      posts(first: 100) {
        ${BLOG_POST_CARD_FIELDS}
      }
      enqueuedScripts(first: 100) {
        ${SCRIPT_FIELDS}
      }
      seo {
        ${TAXONOMY_SEO_FIELDS}
      }
    }
    terms: tags(first: 100, where: { hideEmpty: true, language: ALL }) {
      ${TERM_FIELDS}
    }
  }
`;

export async function getPostTaxonomyArchive(
  taxonomy: PostTaxonomy,
  identifier: string,
  idType: TaxonomyIdentifierType,
): Promise<CmsPostArchive | null> {
  const query = taxonomy === "category" ? CATEGORY_ARCHIVE_QUERY : TAG_ARCHIVE_QUERY;
  const { data, errors } = await graphqlRequest<TaxonomyArchiveResult>(query, { id: identifier, idType });

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error(`The ${taxonomy} archive query returned no data`);
  }
  if (!data.archive) {
    return null;
  }

  const archive = data.archive;
  const languageCode = archive.language?.code?.toLowerCase() || "en";

  return {
    id: archive.id,
    databaseId: archive.databaseId,
    taxonomy,
    name: archive.name?.trim() || (taxonomy === "category" ? "Category" : "Tag"),
    slug: archive.slug || "",
    uri: archive.uri || identifier,
    descriptionHtml: archive.description || "",
    languageCode,
    translations:
      archive.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language.code.toLowerCase(),
            }]
          : [],
      ) || [],
    posts: archive.posts?.nodes.map(mapBlogPost) || [],
    hasMorePosts: archive.posts?.pageInfo.hasNextPage || false,
    terms: mapTerms(data.terms?.nodes, languageCode),
    seo: mapTaxonomySeo(archive.seo),
    scripts: archive.enqueuedScripts?.nodes.map(mapScript) || [],
  };
}

export function mapBlogPost(post: RawBlogPost): PostCardData {
  const contentText = htmlToText(post.content || "");
  const wordCount = contentText ? contentText.split(/\s+/).length : 0;
  const readingTime = post.seo?.readingTime;
  const languageCode = post.language?.code?.toLowerCase();

  const translations: Record<string, string> = {};
  post.translations?.forEach((translation) => {
    if (!translation) return;
    const code = translation.language?.code?.toLowerCase();
    if (code && translation.id) translations[code] = translation.id;
  });

  return {
    id: post.id,
    slug: post.slug || "",
    href: post.uri || undefined,
    title: post.title?.trim() || "Untitled post",
    excerpt: htmlToText(post.excerpt || ""),
    imageUrl: post.featuredImage?.node.sourceUrl || undefined,
    date: post.date || "",
    lastEditedDate: post.modified || undefined,
    databaseId: post.databaseId,
    author: {
      name: post.author?.node.name?.trim() || "Unknown author",
      slug: post.author?.node.slug || undefined,
      href: post.author?.node.uri || undefined,
      avatarUrl: post.author?.node.avatar?.url || undefined,
    },
    authorDatabaseId: post.author?.node.databaseId || undefined,
    wordCount,
    readingTimeMinutes: readingTime && readingTime > 0 ? Math.ceil(readingTime) : Math.max(1, Math.ceil(wordCount / 200)),
    categories: mapPostTerms(post.categories?.nodes, languageCode),
    tags: mapPostTerms(post.tags?.nodes, languageCode),
    translations: Object.keys(translations).length > 0 ? translations : undefined,
  };
}

function mapTerms(terms: RawBlogTerm[] | undefined, languageCode: string): CmsTaxonomyTerm[] {
  const mapped = new Map<string, CmsTaxonomyTerm>();
  terms?.forEach((term) => {
    if (!term.name || !term.slug || !term.uri) return;
    if (term.language?.code && term.language.code.toLowerCase() !== languageCode) return;
    mapped.set(term.name.trim().toLocaleLowerCase(), {
      id: term.id,
      name: term.name,
      slug: term.slug,
      uri: term.uri,
    });
  });
  return [...mapped.values()];
}

function mapPostTerms(terms: RawBlogTerm[] | undefined, languageCode?: string): { name: string; slug: string; href?: string }[] {
  const mapped = new Map<string, { name: string; slug: string; href?: string }>();
  terms?.forEach((term) => {
    if (!term.name || !term.slug) return;
    if (languageCode && term.language?.code && term.language.code.toLowerCase() !== languageCode) return;
    mapped.set(term.name.trim().toLocaleLowerCase(), {
      name: term.name,
      slug: term.slug,
      href: term.uri || undefined,
    });
  });
  return [...mapped.values()];
}

function mapTaxonomySeo(seo: RawTaxonomySeo | null): CmsPageSeo {
  if (!seo) return mapSeo(null);
  const { schema: _schema, ...commonSeo } = seo;
  return mapSeo({ ...commonSeo, schema: null });
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}
