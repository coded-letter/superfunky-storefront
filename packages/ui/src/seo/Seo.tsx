import { useLayoutEffect } from "react";
import { Helmet } from "react-helmet-async";
import { LANGUAGE_OPTIONS } from "../locale/options";
import { useLanguage } from "../locale/LanguageContext";
import { normalizeLanguagePath, usesLanguagePrefixes } from "../locale/urlPaths";
import { normalizeDisplayLabel } from "./htmlEntities";

/** Complete per-route document metadata, social cards, structured data, and language alternates. */

export type SeoTranslation = {
  /** ISO 639-1 language code, e.g. "de", "el". */
  languageCode: string;
  /** Absolute or root-relative URL of the translated page. */
  url: string;
};

export type SeoSchema = {
  pageType?: string;
  articleType?: string;
  companyName?: string;
  companyLogoUrl?: string;
  personName?: string;
};

export type SeoImage = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  type?: string;
};

export type SeoProps = {
  title: string;
  description?: string;
  /** Current page's canonical URL (absolute, including protocol+domain). */
  canonical?: string;
  /** ISO 639-1 language code of *this* page — defaults to "en". */
  languageCode?: string;
  keywords?: string;
  siteName?: string;
  appendSiteName?: boolean;
  robots?: string;
  opengraphType?: "website" | "article" | "product";
  opengraphTitle?: string;
  opengraphDescription?: string;
  /** Preferred social and structured-data image. Content pages should pass their featured image. */
  image?: SeoImage;
  /** Legacy URL-only image input retained for archive and compatibility callers. */
  opengraphImage?: string;
  opengraphPublishedTime?: string;
  opengraphModifiedTime?: string;
  opengraphAuthor?: string;
  opengraphPublisher?: string;
  articleSection?: string;
  articleTags?: string[];
  twitterHandle?: string;
  twitterCreator?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  schema?: SeoSchema;
  /** JSON-LD breadcrumb trail — position is derived from array order. */
  breadcrumbs?: { name: string; url: string }[];
  /** Other-language versions of this same page, for hreflang alternates. */
  translations?: SeoTranslation[];
};

const DEFAULT_SITE_NAME = "Superfunky";

export function Seo({
  title,
  description,
  canonical,
  languageCode = "en",
  keywords,
  siteName = DEFAULT_SITE_NAME,
  appendSiteName = true,
  robots = "index, follow",
  opengraphType = "website",
  opengraphTitle,
  opengraphDescription,
  image,
  opengraphImage,
  opengraphPublishedTime,
  opengraphModifiedTime,
  opengraphAuthor,
  opengraphPublisher,
  articleSection,
  articleTags = [],
  twitterHandle,
  twitterCreator,
  twitterTitle,
  twitterDescription,
  schema,
  breadcrumbs,
  translations = [],
}: SeoProps) {
  const { configuredLanguageCodes } = useLanguage();
  const metaTitle = appendSiteName && siteName ? `${title} · ${siteName}` : title;
  const canonicalCandidate = canonical || (typeof window !== "undefined" ? window.location.href : undefined);
  const resolvedCanonical = canonicalCandidate && typeof window !== "undefined"
    ? (() => {
        try {
          const url = new URL(canonicalCandidate, window.location.origin);
          const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
          const localizedPath = normalizeLanguagePath(
            `${path || "/"}${url.search}`,
            languageCode,
            configuredLanguageCodes,
          );
          return `${window.location.origin}${localizedPath === "/" ? "" : localizedPath}`;
        } catch {
          return canonicalCandidate;
        }
      })()
    : canonicalCandidate;
  const resolvedImageUrl = resolveAbsoluteUrl(image?.url || opengraphImage);
  const imageAlt = image?.alt || title;
  const imageType = image?.type || imageTypeFromUrl(resolvedImageUrl);

  useLayoutEffect(() => {
    document.head
      .querySelectorAll(
        '[data-storefront-seo], meta[name="description"]:not([data-rh]), link[rel="canonical"]:not([data-rh])',
      )
      .forEach((element) => element.remove());
  }, []);

  const breadcrumbJsonLd =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: normalizeDisplayLabel(crumb.name),
            item: typeof window === "undefined"
              ? crumb.url
              : (() => {
                  const url = new URL(crumb.url, window.location.origin);
                  return `${window.location.origin}${normalizeLanguagePath(url.pathname, languageCode, configuredLanguageCodes)}`;
                })(),
          })),
        }
      : null;

  const schemaType = schema?.articleType || schema?.pageType || (opengraphType === "article" ? "Article" : opengraphType === "product" ? "Product" : "WebPage");
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    ...(opengraphType === "article" ? { headline: opengraphTitle || title } : {}),
    description,
    url: resolvedCanonical,
    mainEntityOfPage: resolvedCanonical ? { "@type": "WebPage", "@id": resolvedCanonical } : undefined,
    isPartOf: siteName ? { "@type": "WebSite", name: siteName, url: typeof window !== "undefined" ? window.location.origin : undefined } : undefined,
    datePublished: opengraphPublishedTime,
    dateModified: opengraphModifiedTime,
    author: opengraphAuthor
      ? { "@type": "Person", name: opengraphAuthor }
      : schema?.personName
        ? { "@type": "Person", name: schema.personName }
        : undefined,
    publisher: schema?.companyName
      ? {
          "@type": "Organization",
          name: schema.companyName,
          logo: schema.companyLogoUrl ? { "@type": "ImageObject", url: schema.companyLogoUrl } : undefined,
        }
      : undefined,
    image: resolvedImageUrl
      ? {
          "@type": "ImageObject",
          url: resolvedImageUrl,
          contentUrl: resolvedImageUrl,
          caption: imageAlt,
          width: image?.width,
          height: image?.height,
        }
      : undefined,
    inLanguage: languageCode,
    keywords: keywords || articleTags.join(", ") || undefined,
    articleSection: articleSection || undefined,
  };

  // Resolves each translation's language code against the known LANGUAGE_OPTIONS list
  // so hreflang tags always use a real, recognizable code even if a caller passes
  // something slightly off (e.g. "EL" instead of "el").
  const hreflangLinks = (usesLanguagePrefixes(configuredLanguageCodes) ? translations : [])
    .map((translation) => {
      const option = LANGUAGE_OPTIONS.find((lang) => lang.code === translation.languageCode.toLowerCase());
      return option ? { hrefLang: option.code, href: translation.url } : null;
    })
    .filter((link): link is { hrefLang: string; href: string } => link !== null);

  // Per hreflang spec: the current page must also appear in the alternate set.
  // We add it using canonical (absolute URL preferred) or the current browser URL.
  const selfHref = resolvedCanonical || (typeof window !== "undefined" ? window.location.href : null);
  const selfLink = selfHref && LANGUAGE_OPTIONS.find((lang) => lang.code === languageCode.toLowerCase())
    ? { hrefLang: languageCode.toLowerCase(), href: selfHref }
    : null;
  const allHreflangLinks = !usesLanguagePrefixes(configuredLanguageCodes)
    ? []
    : selfLink
      ? [selfLink, ...hreflangLinks.filter((l) => l.hrefLang !== selfLink.hrefLang)]
      : hreflangLinks;

  // x-default points to the first available language (self preferred, then first translation).
  const xDefaultHref = usesLanguagePrefixes(configuredLanguageCodes)
    ? selfHref || hreflangLinks[0]?.href
    : undefined;

  return (
    <Helmet htmlAttributes={{ lang: languageCode }}>
      <title>{metaTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="robots" content={robots} />
      {opengraphAuthor ? <meta name="author" content={opengraphAuthor} /> : null}

      {/* OpenGraph */}
      <meta property="og:type" content={opengraphType} />
      <meta property="og:title" content={opengraphTitle || title} />
      {opengraphDescription || description ? <meta property="og:description" content={opengraphDescription || description} /> : null}
      {resolvedCanonical ? <meta property="og:url" content={resolvedCanonical} /> : null}
      {resolvedImageUrl ? <meta property="og:image" content={resolvedImageUrl} /> : null}
      {resolvedImageUrl?.startsWith("https://") ? <meta property="og:image:secure_url" content={resolvedImageUrl} /> : null}
      {imageType ? <meta property="og:image:type" content={imageType} /> : null}
      {image?.width ? <meta property="og:image:width" content={String(image.width)} /> : null}
      {image?.height ? <meta property="og:image:height" content={String(image.height)} /> : null}
      {resolvedImageUrl ? <meta property="og:image:alt" content={imageAlt} /> : null}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={languageCode} />
      {allHreflangLinks.map((link) => <meta key={`og-locale-${link.hrefLang}`} property="og:locale:alternate" content={link.hrefLang} />)}
      {opengraphType === "article" && opengraphPublishedTime ? <meta property="article:published_time" content={opengraphPublishedTime} /> : null}
      {opengraphType === "article" && opengraphModifiedTime ? <meta property="article:modified_time" content={opengraphModifiedTime} /> : null}
      {opengraphType === "article" && opengraphAuthor ? <meta property="article:author" content={opengraphAuthor} /> : null}
      {opengraphType === "article" && opengraphPublisher ? <meta property="article:publisher" content={opengraphPublisher} /> : null}
      {opengraphType === "article" && articleSection ? <meta property="article:section" content={articleSection} /> : null}
      {opengraphType === "article" ? articleTags.map((tag) => <meta key={tag} property="article:tag" content={tag} />) : null}

      {/* Twitter */}
      <meta name="twitter:card" content={resolvedImageUrl ? "summary_large_image" : "summary"} />
      {twitterHandle ? <meta name="twitter:site" content={twitterHandle} /> : null}
      {twitterCreator ? <meta name="twitter:creator" content={twitterCreator} /> : null}
      <meta name="twitter:title" content={twitterTitle || title} />
      {twitterDescription || description ? <meta name="twitter:description" content={twitterDescription || description} /> : null}
      {resolvedImageUrl ? <meta name="twitter:image" content={resolvedImageUrl} /> : null}
      {resolvedImageUrl ? <meta name="twitter:image:alt" content={imageAlt} /> : null}

      {resolvedCanonical ? <link rel="canonical" href={resolvedCanonical} /> : null}

      {/* hreflang alternates + x-default fallback (current page + all translations). */}
      {allHreflangLinks.map((link) => (
        <link key={link.hrefLang} rel="alternate" hrefLang={link.hrefLang} href={link.href} />
      ))}
      {xDefaultHref ? <link rel="alternate" hrefLang="x-default" href={xDefaultHref} /> : null}

      {breadcrumbJsonLd ? <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script> : null}
      <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
    </Helmet>
  );
}

function resolveAbsoluteUrl(value?: string): string | undefined {
  if (!value || typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
}

function imageTypeFromUrl(value?: string): string | undefined {
  const extension = value?.match(/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  if (!extension) return undefined;
  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}
