import { normalizePublicRoutePath } from "@funky/shared/route-policy";

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
  const sourcePath = normalizedRoutePath(node?.uri);
  if (!sourcePath) return null;
  const type = connectionName === "users" ? "User" : node?.__typename;
  if (!ROUTABLE_CMS_TYPES.has(type)) return null;
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
  const path = isHomePage
    ? normalizeLanguageRoutePath(sourcePath, language, configuredLanguageCodes)
    : sourcePath;
  let description = "Explore this page on FunkyCommerce.";
  if (type === "Post") description = "Read this story on FunkyCommerce.";
  else if (type?.includes("Product")) description = "Discover this product or collection on FunkyCommerce.";
  else if (type === "CommunityPost") description = "Join this conversation in the FunkyCommerce community.";
  else if (type === "User") description = "View this creator profile on FunkyCommerce.";
  const featuredImage = routeImage(node?.featuredImage?.node) || routeImage(node?.image);
  const socialImage = routeImage(seo.opengraphImage) || routeImage(seo.twitterImage);
  const image = featuredImage || socialImage;
  const robots = `${seo.metaRobotsNoindex === "noindex" ? "noindex" : "index"}, ${seo.metaRobotsNofollow === "nofollow" ? "nofollow" : "follow"}`;

  return {
    path,
    lang: language,
    title: seo.title?.trim() || `${label} | FunkyCommerce`,
    description: seo.metaDesc?.trim() || seo.opengraphDescription?.trim() || description,
    keywords: seo.metaKeywords?.trim() || seo.focuskw?.trim() || "",
    canonical: isHomePage ? path : seo.canonical?.trim() || seo.opengraphUrl?.trim() || "",
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
    breadcrumbs: (seo.breadcrumbs || []).flatMap((breadcrumb) =>
      breadcrumb?.text?.trim() && breadcrumb?.url?.trim()
        ? [{ name: breadcrumb.text.trim(), url: breadcrumb.url.trim() }]
        : [],
    ),
    schemaType: seo.schema?.articleType?.find(Boolean)
      || seo.schema?.pageType?.find(Boolean)
      || (type === "Post" ? "Article" : type?.includes("Product") ? "Product" : "WebPage"),
    source: "cms",
    type,
    indexable: !robots.startsWith("noindex"),
    cmsContent: type === "Page" && typeof node.headlessContent === "string"
      ? node.headlessContent
      : "",
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
