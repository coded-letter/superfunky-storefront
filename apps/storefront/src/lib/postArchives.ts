import type { PostCardData } from "@funky/ui";
import {
  BACKEND_ORIGIN,
  graphqlRequest,
  STOREFRONT_BACKEND_PROFILE,
  STOREFRONT_DEFAULT_LANGUAGE,
  STOREFRONT_EXPECTED_LOCALES,
} from "@funky/sdk";
import { storefrontPostPath } from "./postRoutePaths.mjs";
import { resolvePathLanguageCode } from "@funky/ui/src/locale/urlPaths.ts";
import { BLOG_DATA_COMPATIBILITY_RULES } from "./blogGraphqlCompatibility.ts";
import { requestGraphqlWithCompatibility } from "./graphqlFieldFallback.ts";
import { MALFORMED_POST_ARCHIVE_RULE } from "./postArchiveGraphqlCompatibility.ts";
import {
  mapScript,
  mapSeo,
  type CmsPageScript,
  type CmsPageSeo,
  type CmsPageTranslation,
  type RawCmsScript,
  type RawCmsSeo,
} from "./pages.ts";
import { normalizeFeaturedImage, type RawFeaturedImage } from "@funky/cms";
import {
  createCorePostArchiveQuery,
  shouldPreferCoreGraphqlQueries,
} from "./profileGraphqlCompatibility.ts";
import { htmlToPlainText } from "./htmlText.ts";
import { ARCHIVE_BATCH_SIZE, fetchArchiveNodesInBatches, getArchivePageSize } from "./archiveSettings.ts";

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
  content?: string | null;
  date: string | null;
  modified: string | null;
  language: { code: string | null } | null;
  translations: ({ id: string; databaseId: number; language: { code: string | null } | null } | null)[] | null;
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
  featuredImage: RawFeaturedImage;
  categories: { nodes: RawBlogTerm[] } | null;
  tags: { nodes: RawBlogTerm[] } | null;
  seo: { readingTime: number | null; schema: { raw: string | null } | null } | null;
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
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  } | null;
  enqueuedScripts: { nodes: RawCmsScript[] } | null;
  seo: RawTaxonomySeo | null;
};

type TaxonomyArchiveResult = {
  archive: RawTaxonomyArchive | null;
  terms: { nodes: RawBlogTerm[] } | null;
};

type RestTaxonomyTerm = {
  id: number;
  name: string;
  slug: string;
  link: string;
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
      databaseId
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
        altText
        srcSet
        mediaDetails {
          width
          height
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
    seo {
      readingTime
      schema {
        raw
      }
    }
  }
  pageInfo {
    hasNextPage
    endCursor
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
  opengraphPublisher
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
  query StorefrontCategoryArchive($id: ID!, $idType: CategoryIdType!, $first: Int!, $after: String) {
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
      posts(first: $first, after: $after) {
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
  query StorefrontTagArchive($id: ID!, $idType: TagIdType!, $first: Int!, $after: String) {
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
      posts(first: $first, after: $after) {
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
  expectedLanguageCode = "en",
): Promise<CmsPostArchive | null> {
  const query = taxonomy === "category" ? CATEGORY_ARCHIVE_QUERY : TAG_ARCHIVE_QUERY;
  const targetCount = await getArchivePageSize();
  const initialQuery = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE)
    ? createCorePostArchiveQuery(query)
    : query;
  const loadArchivePage = async (first: number, after: string | null): Promise<TaxonomyArchiveResult> => {
    const { data, errors } = await requestGraphqlWithCompatibility<TaxonomyArchiveResult>(
      graphqlRequest,
      initialQuery,
      { id: identifier, idType, first, after },
      [MALFORMED_POST_ARCHIVE_RULE, ...BLOG_DATA_COMPATIBILITY_RULES],
    );

    // Only treat GraphQL errors as fatal when no usable data came back — a term with
    // zero published posts still resolves normally and shouldn't be downgraded to an
    // "unavailable" error page by unrelated, non-fatal resolver warnings.
    if (!data) {
      if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
      throw new Error(`The ${taxonomy} archive query returned no data`);
    }
    return data;
  };

  const initialData = await loadArchivePage(Math.min(targetCount, ARCHIVE_BATCH_SIZE), null);
  if (!initialData.archive) {
    if (idType === "URI") {
      const slug = taxonomySlugFromUri(identifier);
      if (slug) {
        return getPostTaxonomyArchive(taxonomy, slug, "SLUG", expectedLanguageCode);
      }
    }
    return null;
  }

  let firstPageData: TaxonomyArchiveResult | null = initialData;
  const { nodes: posts, hasMore } = await fetchArchiveNodesInBatches<RawBlogPost>(
    targetCount,
    async (first, after) => {
      const pageData = firstPageData || await loadArchivePage(first, after);
      firstPageData = null;
      if (!pageData.archive) {
        throw new Error(`The ${taxonomy} archive pagination query returned no archive`);
      }
      return {
        nodes: pageData.archive.posts?.nodes || [],
        pageInfo: pageData.archive.posts?.pageInfo || { hasNextPage: false },
      };
    },
  );

  const archive = initialData.archive;
  const languageCode = archive.language?.code?.toLowerCase() || expectedLanguageCode.toLowerCase();

  const terms = initialData.terms?.nodes.some((term) => term.language?.code)
    ? mapTerms(initialData.terms.nodes, languageCode)
    : await getRestTerms(taxonomy, languageCode);

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
        translation?.uri
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language?.code?.toLowerCase() || resolveContentLanguage(translation.uri),
            }]
          : [],
      ) || [],
    posts: posts
      .filter((post) => !post.language?.code || post.language.code.toLowerCase() === languageCode)
      .map(mapBlogPost),
    hasMorePosts: hasMore,
    terms,
    seo: mapTaxonomySeo(archive.seo),
    scripts: archive.enqueuedScripts?.nodes.map(mapScript) || [],
  };
}

async function getRestTerms(taxonomy: PostTaxonomy, languageCode: string): Promise<CmsTaxonomyTerm[]> {
  const resource = taxonomy === "category" ? "categories" : "tags";
  const url = new URL(`/wp-json/wp/v2/${resource}`, BACKEND_ORIGIN);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("hide_empty", "true");
  url.searchParams.set("lang", languageCode);
  url.searchParams.set("_fields", "id,name,slug,link");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The ${taxonomy} archive term query failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`The ${taxonomy} archive term query returned an invalid payload`);
  }
  return payload.flatMap((term: RestTaxonomyTerm) => {
    if (!Number.isInteger(term?.id) || !term.name || !term.slug || !term.link) return [];
    return [{
      id: String(term.id),
      name: htmlToPlainText(term.name),
      slug: term.slug,
      uri: term.link,
    }];
  });
}

function resolveContentLanguage(uri: string): string {
  return resolvePathLanguageCode(
    uri,
    STOREFRONT_EXPECTED_LOCALES,
    STOREFRONT_DEFAULT_LANGUAGE,
    STOREFRONT_BACKEND_PROFILE === "blog",
  );
}

export function mapBlogPost(post: RawBlogPost): PostCardData {
  const contentText = htmlToPlainText(post.content || post.excerpt || "");
  const wordCount = contentText ? contentText.split(/\s+/).length : 0;
  const readingTime = post.seo?.readingTime;
  const languageCode = post.language?.code?.toLowerCase();
  const featuredImage = normalizeFeaturedImage(post.featuredImage, post.seo?.schema ?? null);

  const translations: Record<string, string> = {};
  post.translations?.forEach((translation) => {
    if (!translation) return;
    const code = translation.language?.code?.toLowerCase();
    if (code && translation.databaseId) translations[code] = String(translation.databaseId);
  });

  return {
    id: post.id,
    slug: post.slug || "",
    href: storefrontPostPath({
      uri: post.uri,
      slug: post.slug,
      languageCode,
      defaultLanguage: STOREFRONT_DEFAULT_LANGUAGE,
      configuredLanguageCodes: STOREFRONT_EXPECTED_LOCALES,
    }),
    title: post.title?.trim() || "Untitled post",
    excerpt: htmlToPlainText(post.excerpt || ""),
    imageUrl: featuredImage?.sourceUrl || undefined,
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
    languageCode,
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
    if (term.language?.code?.toLowerCase() !== languageCode) return;
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
  if (!seo) return { ...mapSeo(null), robots: "index, follow" };
  const { schema: _schema, ...commonSeo } = seo;
  return { ...mapSeo({ ...commonSeo, schema: null }), robots: "index, follow" };
}

export function taxonomySlugFromUri(uri: string): string | null {
  const segment = uri.split(/[?#]/, 1)[0].split("/").filter(Boolean).at(-1);
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
