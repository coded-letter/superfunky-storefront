import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { LANGUAGE_OPTIONS } from "../locale/options";

/** Language-tagged SEO head component — a TypeScript rewrite of the legacy
 * prototype's `src/components/seo.js`. That version pulled `title`/`generalSettings`/
 * `schema` from a Gatsby `useStaticQuery` GraphQL fragment; since this project has no
 * GraphQL client yet, every value the original sourced from WPGraphQL is instead a
 * plain prop with sensible defaults, ready to be threaded from real query data once
 * the backend lands (the prop names intentionally mirror the WPGraphQL SEO fields —
 * `metaDesc`, `opengraphImage`, `canonical`, `breadcrumbs`, `schema` — for a low-diff
 * swap later).
 *
 * Adds one thing the legacy version didn't have: proper multi-language `hreflang`
 * alternates driven by `translations`, each resolved against the site's known
 * `LANGUAGE_OPTIONS` list instead of a WPGraphQL `language.code` field. */

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
  opengraphImage?: string;
  opengraphPublishedTime?: string;
  opengraphModifiedTime?: string;
  opengraphAuthor?: string;
  twitterHandle?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  schema?: SeoSchema;
  /** JSON-LD breadcrumb trail — position is derived from array order. */
  breadcrumbs?: { name: string; url: string }[];
  /** Other-language versions of this same page, for hreflang alternates. */
  translations?: SeoTranslation[];
};

const DEFAULT_SITE_NAME = "FunkyCommerce";

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
  opengraphImage,
  opengraphPublishedTime,
  opengraphModifiedTime,
  opengraphAuthor,
  twitterHandle,
  twitterTitle,
  twitterDescription,
  schema,
  breadcrumbs,
  translations = [],
}: SeoProps) {
  const metaTitle = appendSiteName && siteName ? `${title} · ${siteName}` : title;

  useEffect(() => {
    const fallback = document.head.querySelector<HTMLMetaElement>('meta[name="description"]:not([data-rh])');
    if (!fallback) return;
    const nextSibling = fallback.nextSibling;
    fallback.remove();
    return () => document.head.insertBefore(fallback, nextSibling?.parentNode === document.head ? nextSibling : null);
  }, []);

  const breadcrumbJsonLd =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: crumb.url,
          })),
        }
      : null;

  const pageJsonLd =
    schema?.pageType || schema?.articleType
      ? {
          "@context": "https://schema.org",
          "@type": schema.articleType || schema.pageType,
          name: title,
          description,
          url: canonical,
          datePublished: opengraphPublishedTime,
          dateModified: opengraphModifiedTime,
          author: opengraphAuthor ? { "@type": "Person", name: opengraphAuthor } : schema.personName ? { "@type": "Person", name: schema.personName } : undefined,
          publisher: schema.companyName
            ? {
                "@type": "Organization",
                name: schema.companyName,
                logo: schema.companyLogoUrl ? { "@type": "ImageObject", url: schema.companyLogoUrl } : undefined,
              }
            : undefined,
          image: opengraphImage,
          inLanguage: languageCode,
        }
      : null;

  // Resolves each translation's language code against the known LANGUAGE_OPTIONS list
  // so hreflang tags always use a real, recognizable code even if a caller passes
  // something slightly off (e.g. "EL" instead of "el").
  const hreflangLinks = translations
    .map((translation) => {
      const option = LANGUAGE_OPTIONS.find((lang) => lang.code === translation.languageCode.toLowerCase());
      return option ? { hrefLang: option.code, href: translation.url } : null;
    })
    .filter((link): link is { hrefLang: string; href: string } => link !== null);

  // Per hreflang spec: the current page must also appear in the alternate set.
  // We add it using canonical (absolute URL preferred) or the current browser URL.
  const selfHref = canonical || (typeof window !== "undefined" ? window.location.href : null);
  const selfLink = selfHref && LANGUAGE_OPTIONS.find((lang) => lang.code === languageCode.toLowerCase())
    ? { hrefLang: languageCode.toLowerCase(), href: selfHref }
    : null;
  const allHreflangLinks = selfLink
    ? [selfLink, ...hreflangLinks.filter((l) => l.hrefLang !== selfLink.hrefLang)]
    : hreflangLinks;

  // x-default points to the first available language (self preferred, then first translation).
  const xDefaultHref = selfHref || hreflangLinks[0]?.href;

  return (
    <Helmet htmlAttributes={{ lang: languageCode }}>
      <title>{metaTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="robots" content={robots} />

      {/* OpenGraph */}
      <meta property="og:type" content={opengraphType} />
      <meta property="og:title" content={opengraphTitle || title} />
      {opengraphDescription || description ? <meta property="og:description" content={opengraphDescription || description} /> : null}
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {opengraphImage ? <meta property="og:image" content={opengraphImage} /> : null}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={languageCode} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterHandle ? <meta name="twitter:site" content={twitterHandle} /> : null}
      <meta name="twitter:title" content={twitterTitle || title} />
      {twitterDescription || description ? <meta name="twitter:description" content={twitterDescription || description} /> : null}
      {opengraphImage ? <meta name="twitter:image" content={opengraphImage} /> : null}

      {canonical ? <link rel="canonical" href={canonical} /> : null}

      {/* hreflang alternates + x-default fallback (current page + all translations). */}
      {allHreflangLinks.map((link) => (
        <link key={link.hrefLang} rel="alternate" hrefLang={link.hrefLang} href={link.href} />
      ))}
      {xDefaultHref ? <link rel="alternate" hrefLang="x-default" href={xDefaultHref} /> : null}

      {breadcrumbJsonLd ? <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script> : null}
      {pageJsonLd ? <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script> : null}
    </Helmet>
  );
}
