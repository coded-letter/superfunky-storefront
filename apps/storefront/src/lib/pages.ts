import { graphqlRequest, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { normalizeFeaturedImage, type CmsFeaturedImage, type RawFeaturedImage } from "@funky/cms";
import {
  languageHomePath,
  resolvePathLanguageCode,
} from "@funky/ui/src/locale/urlPaths.ts";
import {
  STOREFRONT_DEFAULT_LANGUAGE,
  STOREFRONT_EXPECTED_LOCALES,
} from "@funky/sdk";
import { resolveHomePageDatabaseId } from "./homepageResolution.ts";
import {
  createCompatiblePageLookupQuery,
  normalizePageLookupUri,
  selectPageLookupCandidate,
} from "./pageLookupCompatibility.ts";
import {
  missingGraphqlFieldRule,
  removeGraphqlFieldSelections,
  requestGraphqlWithCompatibility,
  unsupportedRenderedFormatRule,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback.ts";
import {
  createLanguageCompatiblePageQuery,
  createProfilePageQuery,
} from "./profileGraphqlCompatibility.ts";

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
  robotsSource: "explicit" | "seo";
  opengraphTitle: string | null;
  opengraphDescription: string | null;
  opengraphType: string | null;
  opengraphUrl: string | null;
  opengraphImage: string | null;
  opengraphPublishedTime: string | null;
  opengraphPublisher: string | null;
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
  featuredImage: CmsFeaturedImage | null;
  scripts: CmsPageScript[];
  themeStyles: CmsThemeStyles;
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
  opengraphPublisher: string | null;
  opengraphSiteName: string | null;
  opengraphTitle: string | null;
  opengraphType: string | null;
  opengraphUrl: string | null;
  readingTime?: number | null;
  schema: { articleType: (string | null)[] | null; pageType: (string | null)[] | null; raw?: string | null } | null;
  title: string | null;
  twitterDescription: string | null;
  twitterTitle: string | null;
};

export type CmsPublicRobots = {
  noindex: boolean;
  nofollow: boolean;
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
    author: {
      node: {
        id: string;
        name: string | null;
        description: string | null;
        uri: string | null;
        avatar: { url: string | null } | null;
      };
    } | null;
    featuredImage: RawFeaturedImage;
    enqueuedScripts: {
      nodes: RawCmsScript[];
    } | null;
    seo: RawCmsSeo | null;
    funkycommercePublicRobots?: CmsPublicRobots | null;
    themeStyles: CmsThemeStyles | null;
  } | null;
};

type PageByNameResult = {
  pages: {
    nodes: {
      databaseId: number;
      slug: string | null;
      uri: string | null;
    }[];
  } | null;
};

type ReadingSettingsResult = {
  readingSettings: {
    showOnFront: string | null;
    pageOnFront: number | null;
  } | null;
};

const READING_SETTINGS_QUERY = /* GraphQL */ `
  query StorefrontReadingSettings {
    readingSettings {
      showOnFront
      pageOnFront
    }
  }
`;

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
          srcSet
          mediaDetails {
            width
            height
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
        opengraphPublisher
        opengraphSiteName
        opengraphTitle
        opengraphType
        opengraphUrl
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

const PAGE_COMPATIBILITY_RULES = [
  {
    matches: (message) => message.includes("Cannot access offset of type string on string"),
    transform: createLanguageCompatiblePageQuery,
  },
  missingGraphqlFieldRule("headlessContent"),
  missingGraphqlFieldRule("headlessShortcodes"),
  missingGraphqlFieldRule("themeStyles"),
  missingGraphqlFieldRule("enqueuedScripts"),
  missingGraphqlFieldRule("language"),
  missingGraphqlFieldRule("translations"),
  missingGraphqlFieldRule("seo"),
  missingGraphqlFieldRule("funkycommercePublicRobots"),
  unsupportedRenderedFormatRule,
] as const;

const PAGE_STATUS_COMPATIBILITY_RULE: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: createCompatiblePageLookupQuery,
};

const PAGE_BY_NAME_QUERY = /* GraphQL */ `
  query StorefrontPageByName($name: String!) {
    pages(first: 10, where: { name: $name, status: PUBLISH }) {
      nodes {
        databaseId
        slug
        uri
      }
    }
  }
`;

export async function getPageByUri(uri: string): Promise<CmsPage | null> {
  const normalizedUri = normalizePageLookupUri(uri);
  const page = await getPage(normalizedUri, "URI");
  if (page) return page;

  const slug = normalizedUri.split("/").filter(Boolean).at(-1);
  if (!slug) return null;

  const { data, errors } = await requestGraphqlWithCompatibility<PageByNameResult>(
    graphqlRequest,
    PAGE_BY_NAME_QUERY,
    { name: slug },
    [PAGE_STATUS_COMPATIBILITY_RULE],
  );
  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data?.pages) {
    throw new Error("The page name lookup returned no pages");
  }

  const requireExactUri = STOREFRONT_BACKEND_PROFILE === "blog"
    && /^\/[a-z]{2}(?:-[a-z0-9]+)*(?:\/|$)/i.test(normalizedUri);
  const candidate = selectPageLookupCandidate(
    data.pages.nodes,
    normalizedUri,
    slug,
    requireExactUri,
  );
  if (!candidate) return null;

  const resolvedPage = await getPage(candidate.databaseId, "DATABASE_ID");
  return resolvedPage && !resolvedPage.uri
    ? { ...resolvedPage, uri: normalizedUri }
    : resolvedPage;
}

export async function getHomePage(
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): Promise<CmsPage | null> {
  const { data, errors } = await graphqlRequest<ReadingSettingsResult>(READING_SETTINGS_QUERY);
  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  const settings = data?.readingSettings;
  if (!settings) throw new Error("The reading settings query returned no settings");
  if (settings.showOnFront !== "page") return null;
  if (!settings.pageOnFront) throw new Error("WordPress has no static front page configured");

  const frontPage = await getPage(settings.pageOnFront, "DATABASE_ID");
  if (!frontPage) {
    throw new Error(`The configured static front page ${settings.pageOnFront} was not found`);
  }
  const selectedPageId = resolveHomePageDatabaseId(
    frontPage,
    languageCode,
    configuredLanguageCodes,
    configuredLanguageCodes[0],
  );
  if (!selectedPageId) {
    const localizedHome = await getPageByUri(languageHomePath(languageCode, configuredLanguageCodes));
    if (!localizedHome) return null;
    return {
      ...localizedHome,
      uri: languageHomePath(languageCode, configuredLanguageCodes),
    };
  }
  const selectedPage = selectedPageId === frontPage.databaseId
    ? frontPage
    : await getPage(selectedPageId, "DATABASE_ID");
  if (!selectedPage) {
    throw new Error(`The translated static front page ${selectedPageId} was not found`);
  }

  return {
    ...selectedPage,
    uri: languageHomePath(selectedPage.languageCode, configuredLanguageCodes),
    translations: selectedPage.translations.map((translation) => ({
      ...translation,
      uri: languageHomePath(translation.languageCode, configuredLanguageCodes),
    })),
  };
}

async function getPage(id: string | number, idType: "URI" | "DATABASE_ID"): Promise<CmsPage | null> {
  const query = createProfilePageQuery(PAGE_QUERY, STOREFRONT_BACKEND_PROFILE);
  const result = await requestGraphqlWithCompatibility<PageResult>(
    graphqlRequest,
    query,
    { id, idType },
    PAGE_COMPATIBILITY_RULES,
  );
  const { data, errors } = result;

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
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
    headlessContent: page.headlessContent || page.content || "",
    headlessShortcodes: page.headlessShortcodes?.filter((shortcode): shortcode is string => Boolean(shortcode)) || [],
    modified: page.modified,
    templateName: page.template?.templateName || null,
    languageCode: page.language?.code?.toLowerCase() || resolvePathLanguageCode(
      page.uri || (idType === "URI" ? String(id) : ""),
      STOREFRONT_EXPECTED_LOCALES,
      STOREFRONT_DEFAULT_LANGUAGE,
      STOREFRONT_BACKEND_PROFILE === "blog",
    ),
    translations:
      page.translations?.flatMap((translation) =>
        translation?.uri
          ? [{
              databaseId: translation.databaseId,
              uri: translation.uri,
              languageCode: translation.language?.code?.toLowerCase() || resolvePathLanguageCode(
                translation.uri,
                STOREFRONT_EXPECTED_LOCALES,
                STOREFRONT_DEFAULT_LANGUAGE,
                STOREFRONT_BACKEND_PROFILE === "blog",
              ),
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
    featuredImage: normalizeFeaturedImage(page.featuredImage, seo?.schema),
    scripts: page.enqueuedScripts?.nodes.map(mapScript) || [],
    themeStyles: page.themeStyles || emptyThemeStyles(),
    seo: mapSeo(seo, page.funkycommercePublicRobots),
  };
}

export function emptyThemeStyles(): CmsThemeStyles {
  return {
    customCss: "",
    fontFaceStyles: "",
    globalStyles: "",
    stylesheets: [],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
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

export function mapSeo(
  seo: RawCmsSeo | null | undefined,
  publicRobots?: CmsPublicRobots | null,
): CmsPageSeo {
  return {
    title: seo?.title || null,
    description: seo?.metaDesc || null,
    keywords: seo?.metaKeywords || null,
    canonical: seo?.canonical || null,
    robots: buildRobotsValue(seo?.metaRobotsNoindex, seo?.metaRobotsNofollow, publicRobots),
    robotsSource: publicRobots ? "explicit" : "seo",
    opengraphTitle: seo?.opengraphTitle || null,
    opengraphDescription: seo?.opengraphDescription || null,
    opengraphType: seo?.opengraphType || null,
    opengraphUrl: seo?.opengraphUrl || null,
    opengraphImage: seo?.opengraphImage?.sourceUrl || null,
    opengraphPublishedTime: seo?.opengraphPublishedTime || null,
    opengraphPublisher: seo?.opengraphPublisher || null,
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

function buildRobotsValue(
  noindex?: string | null,
  nofollow?: string | null,
  publicRobots?: CmsPublicRobots | null,
): string {
  const shouldNoindex = publicRobots ? publicRobots.noindex : noindex === "noindex";
  const shouldNofollow = publicRobots ? publicRobots.nofollow : nofollow === "nofollow";
  return `${shouldNoindex ? "noindex" : "index"}, ${shouldNofollow ? "nofollow" : "follow"}`;
}
