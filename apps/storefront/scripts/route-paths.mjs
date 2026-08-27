import { normalizePublicRoutePath } from "@funky/shared/route-policy";
import { storefrontPostPath } from "../src/lib/postRoutePaths.mjs";

export const ROUTABLE_CMS_TYPES = new Set([
  "Category",
  "CommunityPost",
  "ExternalProduct",
  "GroupProduct",
  "Page",
  "Post",
  "ProductBrand",
  "ProductCategory",
  "ProductTag",
  "SimpleProduct",
  "Tag",
  "User",
  "VariableProduct",
]);

export function normalizedRoutePath(uri) {
  return normalizePublicRoutePath(uri);
}

export function prerenderRouteDirectoryPath(routePath) {
  const normalizedPath = normalizedRoutePath(routePath);
  if (!normalizedPath) {
    throw new Error(`Cannot prerender invalid route path: ${routePath}`);
  }
  if (normalizedPath === "/") return "";

  return normalizedPath
    .slice(1)
    .split("/")
    .map((segment) => {
      try {
        const decodedSegment = decodeURIComponent(segment);
        return decodedSegment === "."
          || decodedSegment === ".."
          || /[/\\\0]/.test(decodedSegment)
          ? segment
          : decodedSegment;
      } catch {
        return segment;
      }
    })
    .join("/");
}

export function normalizeLanguageRoutePath(path, languageCode, configuredLanguageCodes = []) {
  const codes = [...new Set(configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean))];
  const segments = path.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const hasPrefix = codes.includes(first);
  if (codes.length < 2) {
    return hasPrefix ? `/${segments.slice(1).join("/")}` || "/" : path;
  }
  const selected = codes.includes(languageCode?.toLowerCase()) ? languageCode.toLowerCase() : codes[0];
  return `/${selected}${hasPrefix ? `/${segments.slice(1).join("/")}` : path === "/" ? "" : path}`;
}

export function cmsRouteFromNode(node, connectionName, defaultLanguage = "en", configuredLanguageCodes = []) {
  const type = connectionName === "users" ? "User" : node?.__typename;
  if (!ROUTABLE_CMS_TYPES.has(type)) return null;
  const sourceUri = node?.uri || (type === "Page" && node?.slug ? `/${node.slug}/` : null);
  const sourcePath = normalizedRoutePath(sourceUri);
  if (!sourcePath) return null;
  const labelName = connectionName === "contentNodes" ? "title" : "name";
  const label = node?.[labelName]?.trim() || "FunkyCommerce";
  const seo = node?.seo || {};
  const language = node?.language?.code?.trim().toLowerCase()
    || seo.language?.trim().toLowerCase()
    || sourcePath.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase()
    || defaultLanguage;
  const isHomePage = type === "Page" && sourcePath === "/" && node?.isFrontPage === true;
  if (type === "Page" && sourcePath === "/" && !isHomePage) return null;
  // Multilingual front pages can share "/" in WPGraphQL even though each one
  // must be emitted at its language root on the storefront.
  const path = type === "Post"
    ? storefrontPostPath({
        uri: sourcePath,
        slug: node?.slug,
        languageCode: language,
        defaultLanguage,
        configuredLanguageCodes,
      })
    : isHomePage
    ? language === defaultLanguage
      ? "/"
      : normalizeLanguageRoutePath(sourcePath, language, configuredLanguageCodes)
    : sourcePath;
  let description = "Explore this page on FunkyCommerce.";
  if (type === "Post") description = "Read this story on FunkyCommerce.";
  else if (type?.includes("Product")) description = "Discover this product or collection on FunkyCommerce.";
  else if (type === "CommunityPost") description = "Join this conversation in the FunkyCommerce community.";
  else if (type === "User") description = "View this creator profile on FunkyCommerce.";
  const featuredImage = routeImage(node?.featuredImage?.node) || routeImage(node?.image);
  const socialImage = routeImage(seo.opengraphImage) || routeImage(seo.twitterImage);
  const image = featuredImage || socialImage;
  const publicRobots = node?.funkycommercePublicRobots;
  const noindex = publicRobots
    ? publicRobots.noindex === true
    : seo.metaRobotsNoindex === "noindex";
  const nofollow = publicRobots
    ? publicRobots.nofollow === true
    : seo.metaRobotsNofollow === "nofollow";
  const robots = isHomePage
    ? "index, follow"
    : `${noindex ? "noindex" : "index"}, ${nofollow ? "nofollow" : "follow"}`;
  const breadcrumbs = (seo.breadcrumbs || []).flatMap((breadcrumb) =>
    breadcrumb?.text?.trim() && breadcrumb?.url?.trim()
      ? [{ name: breadcrumb.text.trim(), url: breadcrumb.url.trim() }]
      : [],
  );
  if (type === "Post" && breadcrumbs.length) {
    breadcrumbs[breadcrumbs.length - 1] = {
      ...breadcrumbs[breadcrumbs.length - 1],
      url: path,
    };
  }

  const route = {
    path,
    lang: language,
    title: seo.title?.trim() || `${label} | FunkyCommerce`,
    description: seo.metaDesc?.trim() || seo.opengraphDescription?.trim() || description,
    keywords: seo.metaKeywords?.trim() || seo.focuskw?.trim() || "",
    canonical: isHomePage || type === "Post" ? path : seo.canonical?.trim() || seo.opengraphUrl?.trim() || "",
    robots,
    image,
    opengraphAuthor: seo.opengraphAuthor?.trim() || "",
    opengraphDescription: seo.opengraphDescription?.trim() || "",
    opengraphModifiedTime: seo.opengraphModifiedTime?.trim() || node?.modified?.trim() || "",
    opengraphPublishedTime: seo.opengraphPublishedTime?.trim() || node?.date?.trim() || "",
    opengraphPublisher: seo.opengraphPublisher?.trim() || "",
    opengraphSiteName: seo.opengraphSiteName?.trim() || "FunkyCommerce",
    opengraphTitle: seo.opengraphTitle?.trim() || "",
    opengraphType: seo.opengraphType?.trim() || (type === "Post" ? "article" : type?.includes("Product") ? "product" : "website"),
    twitterDescription: seo.twitterDescription?.trim() || "",
    twitterTitle: seo.twitterTitle?.trim() || "",
    breadcrumbs,
    schemaType: seo.schema?.articleType?.find(Boolean)
      || seo.schema?.pageType?.find(Boolean)
      || (type === "Post" ? "Article" : type?.includes("Product") ? "Product" : "WebPage"),
    source: "cms",
    redirectFrom: type === "Post" && sourcePath !== path ? sourcePath : "",
    robotsSource: publicRobots ? "explicit" : "seo",
    type,
    indexable: !robots.startsWith("noindex"),
    cmsContent: type === "Page" && typeof node.headlessContent === "string"
      ? node.headlessContent
      : "",
  };
  if (type !== "Page") return route;
  return {
    ...route,
    cmsPage: {
      id: node.id || `page-${node.databaseId}`,
      databaseId: Number(node.databaseId) || 0,
      slug: node.slug || null,
      uri: path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`,
      title: label,
      content: typeof node.content === "string" ? node.content : "",
      headlessContent: typeof node.headlessContent === "string"
        ? node.headlessContent
        : typeof node.content === "string" ? node.content : "",
      headlessShortcodes: Array.isArray(node.headlessShortcodes)
        ? node.headlessShortcodes.filter((shortcode) => typeof shortcode === "string")
        : [],
      modified: node.modified || null,
      templateName: null,
      languageCode: language,
      translations: (node.translations || []).flatMap((translation) => {
        if (!translation?.uri) return [];
        const translationLanguage = translation.language?.code?.trim().toLowerCase()
          || translation.uri.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase();
        return translationLanguage
          ? [{
              databaseId: Number(translation.databaseId) || 0,
              uri: translation.uri,
              languageCode: translationLanguage,
            }]
          : [];
      }),
      author: null,
      featuredImage: null,
      scripts: [],
      themeStyles: {
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
      },
      seo: {
        title: route.title || null,
        description: route.description || null,
        keywords: route.keywords || null,
        canonical: route.canonical || null,
        robots: route.robots,
        robotsSource: route.robotsSource,
        opengraphTitle: route.opengraphTitle || null,
        opengraphDescription: route.opengraphDescription || null,
        opengraphType: route.opengraphType || null,
        opengraphUrl: route.canonical || null,
        opengraphImage: route.image?.url || null,
        opengraphPublishedTime: route.opengraphPublishedTime || null,
        opengraphPublisher: route.opengraphPublisher || null,
        opengraphModifiedTime: route.opengraphModifiedTime || null,
        opengraphAuthor: route.opengraphAuthor || null,
        siteName: route.opengraphSiteName || null,
        twitterTitle: route.twitterTitle || null,
        twitterDescription: route.twitterDescription || null,
        breadcrumbs: route.breadcrumbs,
        pageType: route.schemaType || null,
        articleType: null,
      },
    },
  };
}

function routeImage(image) {
  const url = image?.sourceUrl?.trim();
  if (!url) return null;
  const width = Number(image.mediaDetails?.width);
  const height = Number(image.mediaDetails?.height);
  return {
    url,
    alt: image.altText?.trim() || "",
    type: image.mimeType?.trim() || "",
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    ...(Number.isFinite(height) && height > 0 ? { height } : {}),
  };
}
