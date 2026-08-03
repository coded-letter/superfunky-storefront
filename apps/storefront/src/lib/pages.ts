import { graphqlRequest } from "./graphqlClient";

export type CmsPageScript = {
  id: string;
  handle: string | null;
  src: string | null;
  strategy: string | null;
  groupLocation: string | null;
  before: string[];
  after: string[];
  dependencies: CmsPageScript[] | null;
};

export type CmsPageTranslation = {
  databaseId: number;
  languageCode: string;
  uri: string;
};

export type CmsPageSeo = {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical: string | null;
  robots: string;
  opengraphTitle: string | null;
  opengraphDescription: string | null;
  opengraphType: string | null;
  opengraphUrl: string | null;
  opengraphImage: string | null;
  opengraphPublishedTime: string | null;
  opengraphModifiedTime: string | null;
  opengraphAuthor: string | null;
  siteName: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  breadcrumbs: { name: string; url: string }[];
  pageType: string | null;
  articleType: string | null;
};

export type CmsThemeStyles = {
  customCss: string;
  fontFaceStyles: string;
  globalStyles: string;
  stylesheets: string[];
  colors: { slug: string; name: string; color: string }[];
  fontFamilies: { slug: string; name: string; fontFamily: string }[];
  fontSizes: { slug: string; name: string; size: string }[];
  gradients: { slug: string; name: string; gradient: string }[];
  spacingSizes: { slug: string; name: string; size: string }[];
  contentSize: string;
  wideSize: string;
};

export type CmsPage = {
  id: string;
  databaseId: number;
  slug: string | null;
  uri: string;
  title: string;
  content: string;
  headlessContent: string;
  headlessShortcodes: string[];
  modified: string | null;
  templateName: string | null;
  languageCode: string;
  translations: CmsPageTranslation[];
  seo: CmsPageSeo;
  author: {
    id: string;
    name: string;
    description: string | null;
    uri: string | null;
    avatarUrl: string | null;
  } | null;
  featuredImage: {
    sourceUrl: string;
    altText: string;
  } | null;
  scripts: CmsPageScript[];
  themeStyles: CmsThemeStyles;
  /** Set when this page is a registered special storefront page. */
  specialPageKey: SpecialPageKey | null;
};

export type SpecialPageKey =
  | "home"
  | "shop"
  | "blog"
  | "cart"
  | "checkout"
  | "account";

const SPECIAL_PAGE_KEYS = new Set<SpecialPageKey>(["home", "shop", "blog", "cart", "checkout", "account"]);

function isSpecialPageKey(value: unknown): value is SpecialPageKey {
  return typeof value === "string" && SPECIAL_PAGE_KEYS.has(value as SpecialPageKey);
}

export type CmsSpecialPage = CmsPage & {
  headlessContent: string;
  headlessShortcodes: string[];
};

export type RawCmsScript = {
  id: string;
  handle: string | null;
  src: string | null;
  strategy: string | null;
  groupLocation: string | null;
  before: (string | null)[] | null;
  after: (string | null)[] | null;
  dependencies?: RawCmsScript[] | null;
};

export type RawCmsSeo = {
  breadcrumbs: ({ text: string | null; url: string | null } | null)[] | null;
  canonical: string | null;
  metaDesc: string | null;
  metaKeywords: string | null;
  metaRobotsNofollow: string | null;
  metaRobotsNoindex: string | null;
  opengraphAuthor: string | null;
  opengraphDescription: string | null;
  opengraphImage: { sourceUrl: string | null } | null;
  opengraphModifiedTime: string | null;
  opengraphPublishedTime: string | null;
  opengraphSiteName: string | null;
  opengraphTitle: string | null;
  opengraphType: string | null;
  opengraphUrl: string | null;
  readingTime?: number | null;
  schema: { articleType: (string | null)[] | null; pageType: (string | null)[] | null } | null;
  title: string | null;
  twitterDescription: string | null;
  twitterTitle: string | null;
};

export const THEME_STYLES_FIELDS = /* GraphQL */ `
  customCss
  fontFaceStyles
  globalStyles
  stylesheets
  colors { slug name color }
  fontFamilies { slug name fontFamily }
  fontSizes { slug name size }
  gradients { slug name gradient }
  spacingSizes { slug name size }
  contentSize
  wideSize
`;

type PageResult = {
  page: {
    id: string;
    databaseId: number;
    slug: string | null;
    uri: string | null;
    title: string | null;
    content: string | null;
    headlessContent: string | null;
    headlessShortcodes: (string | null)[] | null;
    modified: string | null;
    template: { templateName: string | null } | null;
    language: { code: string | null } | null;
    translations: ({ databaseId: number; uri: string | null; language: { code: string | null } | null } | null)[] | null;
    funkycommerceSpecialPageKey: string | null;
    author: {
      node: {
        id: string;
        name: string | null;
        description: string | null;
        uri: string | null;
        avatar: { url: string | null } | null;
      };
    } | null;
    featuredImage: {
      node: {
        sourceUrl: string | null;
        altText: string | null;
      } | null;
    } | null;
    enqueuedScripts: {
      nodes: RawCmsScript[];
    } | null;
    seo: RawCmsSeo | null;
    themeStyles: CmsThemeStyles;
  } | null;
};

const PAGE_QUERY = /* GraphQL */ `
  query StorefrontPage($id: ID!, $idType: PageIdType!) {
    page(id: $id, idType: $idType) {
      id
      databaseId
      slug
      uri
      title
      content(format: RENDERED)
      headlessContent
      headlessShortcodes
      modified
      template {
        templateName
      }
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
      funkycommerceSpecialPageKey
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
      featuredImage {
        node {
          sourceUrl
          altText
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

type SpecialPageFields = {
  id: string;
  databaseId: number;
  uri: string | null;
  headlessContent: string | null;
  headlessShortcodes: (string | null)[] | null;
  themeStyles: CmsThemeStyles;
};

type SpecialPageByUriResult = {
  page: SpecialPageFields | null;
};

type FrontPageResult = {
  pages: {
    nodes: { databaseId: number; isFrontPage: boolean }[];
  } | null;
};

const SPECIAL_PAGE_FIELDS_QUERY = /* GraphQL */ `
  query StorefrontSpecialPageFields($key: String!) {
    page: funkycommerceSpecialPage(key: $key) {
      id
      databaseId
      uri
      headlessContent
      headlessShortcodes
      themeStyles {
        ${THEME_STYLES_FIELDS}
      }
    }
  }
`;

const SPECIAL_PAGE_BY_DATABASE_ID_QUERY = /* GraphQL */ `
  query StorefrontTranslatedSpecialPageFields($id: ID!) {
    page(id: $id, idType: DATABASE_ID) {
      id
      databaseId
      uri
      headlessContent
      headlessShortcodes
      themeStyles {
        ${THEME_STYLES_FIELDS}
      }
    }
  }
`;

const FRONT_PAGE_QUERY = /* GraphQL */ `
  query StorefrontFrontPage($language: LanguageCodeFilterEnum!) {
    pages(first: 100, where: { status: PUBLISH, language: $language }) {
      nodes {
        databaseId
        isFrontPage
      }
    }
  }
`;

export async function getPageByUri(uri: string): Promise<CmsPage | null> {
  return getPage(uri, "URI");
}

async function getPage(id: string | number, idType: "URI" | "DATABASE_ID"): Promise<CmsPage | null> {
  const { data, errors } = await graphqlRequest<PageResult>(PAGE_QUERY, { id, idType });

  if (errors?.length) {
    // Gracefully handle older backends that don't yet have funkycommerceSpecialPageKey
    const fatalErrors = errors.filter((e) => !e.message.includes("funkycommerceSpecialPageKey"));
    if (fatalErrors.length) throw new Error(fatalErrors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The page query returned no data");
  }
  if (!data.page) {
    return null;
  }

  const { page } = data;
  const author = page.author?.node;
  const seo = page.seo;

  return {
    id: page.id,
    databaseId: page.databaseId,
    slug: page.slug,
    uri: page.uri || (idType === "URI" ? String(id) : ""),
    title: page.title?.trim() || "Untitled page",
    content: page.content || "",
    headlessContent: page.headlessContent || "",
    headlessShortcodes: page.headlessShortcodes?.filter((shortcode): shortcode is string => Boolean(shortcode)) || [],
    modified: page.modified,
    templateName: page.template?.templateName || null,
    languageCode: page.language?.code?.toLowerCase() || "en",
    specialPageKey: isSpecialPageKey(page.funkycommerceSpecialPageKey) ? page.funkycommerceSpecialPageKey : null,
    translations:
      page.translations?.flatMap((translation) =>
        translation?.uri && translation.language?.code
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language.code.toLowerCase(),
            }]
          : [],
      ) || [],
    author: author
      ? {
          id: author.id,
          name: author.name?.trim() || "Unknown author",
          description: author.description,
          uri: author.uri,
          avatarUrl: author.avatar?.url || null,
        }
      : null,
    featuredImage: page.featuredImage?.node?.sourceUrl
      ? {
          sourceUrl: page.featuredImage.node.sourceUrl,
          altText: page.featuredImage.node.altText || "",
        }
      : null,
    scripts: page.enqueuedScripts?.nodes.map(mapScript) || [],
    themeStyles: page.themeStyles,
    seo: mapSeo(seo),
  };
}

export async function getSpecialPage(
  key: SpecialPageKey,
  languageCode: string,
  backendLanguageCode: string,
): Promise<CmsSpecialPage | null> {
  const lookup = await requestSpecialPageLookup(key);
  if (!lookup?.databaseId) {
    if (key !== "home") return null;
    return requestFrontPage(backendLanguageCode);
  }

  const basePage = await getPage(lookup.databaseId, "DATABASE_ID");
  if (!basePage) {
    throw new Error(`WordPress returned special page "${key}" but its page node is unavailable`);
  }

  async function requestFrontPage(backendLanguageCode: string): Promise<CmsSpecialPage | null> {
    const { data, errors } = await graphqlRequest<FrontPageResult>(FRONT_PAGE_QUERY, {
      language: backendLanguageCode,
    });
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    if (!data) throw new Error("The front page query returned no data");
    const frontPage = data.pages?.nodes.find(({ isFrontPage }) => isFrontPage);
    return frontPage ? getPage(frontPage.databaseId, "DATABASE_ID") : null;
  }

  if (basePage.languageCode !== languageCode) {
    const translation = basePage.translations.find(({ languageCode: translatedLanguage }) => translatedLanguage === languageCode);
    if (!translation) return null;

    const [translatedPage, translatedFields] = await Promise.all([
      getPage(translation.databaseId, "DATABASE_ID"),
      requestSpecialPageFieldsByDatabaseId(translation.databaseId),
    ]);
    if (!translatedPage || !translatedFields) {
      throw new Error(`The ${languageCode.toUpperCase()} translation for special page "${key}" is unavailable`);
    }
    return mergeSpecialPage(translatedPage, translatedFields);
  }

  return mergeSpecialPage(basePage, lookup);
}

async function requestSpecialPageLookup(key: SpecialPageKey): Promise<SpecialPageFields | null> {
  const { data, errors } = await graphqlRequest<SpecialPageByUriResult>(
    SPECIAL_PAGE_FIELDS_QUERY,
    { key },
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The special page lookup returned no data");
  return data.page;
}

async function requestSpecialPageFieldsByDatabaseId(databaseId: number): Promise<SpecialPageFields | null> {
  const { data, errors } = await graphqlRequest<SpecialPageByUriResult>(
    SPECIAL_PAGE_BY_DATABASE_ID_QUERY,
    { id: databaseId },
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The translated special page lookup returned no data");
  return data.page;
}

function mergeSpecialPage(page: CmsPage, fields: SpecialPageFields): CmsSpecialPage {
  if (page.id !== fields.id) {
    throw new Error(`Special page lookup mismatch for "${page.uri}"`);
  }
  return {
    ...page,
    headlessContent: fields.headlessContent || "",
    headlessShortcodes: fields.headlessShortcodes?.filter((shortcode): shortcode is string => Boolean(shortcode)) || [],
    themeStyles: fields.themeStyles,
  };
}

export function mapScript(script: RawCmsScript): CmsPageScript {
  return {
    id: script.id,
    handle: script.handle,
    src: script.src,
    strategy: script.strategy,
    groupLocation: script.groupLocation,
    before: script.before?.filter((code): code is string => Boolean(code)) || [],
    after: script.after?.filter((code): code is string => Boolean(code)) || [],
    dependencies: script.dependencies?.map(mapScript) ?? null,
  };
}

export function mapSeo(seo: RawCmsSeo | null | undefined): CmsPageSeo {
  return {
    title: seo?.title || null,
    description: seo?.metaDesc || null,
    keywords: seo?.metaKeywords || null,
    canonical: seo?.canonical || null,
    robots: buildRobotsValue(seo?.metaRobotsNoindex, seo?.metaRobotsNofollow),
    opengraphTitle: seo?.opengraphTitle || null,
    opengraphDescription: seo?.opengraphDescription || null,
    opengraphType: seo?.opengraphType || null,
    opengraphUrl: seo?.opengraphUrl || null,
    opengraphImage: seo?.opengraphImage?.sourceUrl || null,
    opengraphPublishedTime: seo?.opengraphPublishedTime || null,
    opengraphModifiedTime: seo?.opengraphModifiedTime || null,
    opengraphAuthor: seo?.opengraphAuthor || null,
    siteName: seo?.opengraphSiteName || null,
    twitterTitle: seo?.twitterTitle || null,
    twitterDescription: seo?.twitterDescription || null,
    breadcrumbs:
      seo?.breadcrumbs?.flatMap((breadcrumb) =>
        breadcrumb?.text && breadcrumb.url ? [{ name: breadcrumb.text, url: breadcrumb.url }] : [],
      ) || [],
    pageType: seo?.schema?.pageType?.find((value): value is string => Boolean(value)) || null,
    articleType: seo?.schema?.articleType?.find((value): value is string => Boolean(value)) || null,
  };
}

function buildRobotsValue(noindex?: string | null, nofollow?: string | null): string {
  return `${noindex === "noindex" ? "noindex" : "index"}, ${nofollow === "nofollow" ? "nofollow" : "follow"}`;
}
