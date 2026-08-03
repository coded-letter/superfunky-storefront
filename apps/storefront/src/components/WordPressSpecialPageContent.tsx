import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Seo, useLanguage } from "@funky/ui";
import { Breadcrumbs, seoBreadcrumbsToItems } from "./Breadcrumbs";
import { prefetchIncrementalData, useIncrementalData } from "../lib/incrementalData";
import { executeContentScripts, mountEnqueuedScripts } from "../lib/pageScripts";
import { mountPageStyles } from "../lib/pageStyles";
import { getSpecialPage, type SpecialPageKey } from "../lib/pages";
import {
  WORDPRESS_SHORTCODE_RENDERERS,
  type WordPressShortcodeAttributes,
  type WordPressShortcodeRenderer,
} from "./wordpressShortcodes";
import { ContentLoadingState } from "./ContentLoadingState";

type WordPressSpecialPageContentProps = {
  pageKey: SpecialPageKey;
  className?: string;
  shortcodeRenderers?: Record<string, WordPressShortcodeRenderer>;
  shortcodeFallbacks?: Record<string, WordPressShortcodeAttributes>;
  defaultShortcodes?: { name: string; attributes: WordPressShortcodeAttributes }[];
  showLoadingState?: boolean;
};

export function WordPressSpecialPageContent({ pageKey, className = "", shortcodeRenderers = {}, shortcodeFallbacks = {}, defaultShortcodes = [], showLoadingState = true }: WordPressSpecialPageContentProps) {
  const { languageCode, languageBackendCode, languageOptions } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: page, isLoading, error } = useIncrementalData(
    `special-page:v5:${pageKey}:${languageCode}:${languageBackendCode}`,
    () => getSpecialPage(pageKey, languageCode, languageBackendCode),
  );

  // When the fetched page's canonical URI differs from the browser's current
  // path (e.g. user is on /moje-konto but we're now serving the English page
  // whose URI is /account), redirect to keep the URL in sync with the language.
  useEffect(() => {
    if (!page || pageKey === "home") return;
    try {
      const pageUri = new URL(page.uri, window.location.origin).pathname;
      const normalizedUri = pageUri.endsWith("/") ? pageUri.slice(0, -1) : pageUri || "/";
      const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
      if (normalizedUri && normalizedUri !== normalizedPathname) {
        navigate(normalizedUri, { replace: true });
      }
    } catch {
      // ignore URL parse errors
    }
  }, [navigate, page, pageKey, pathname]);

  useEffect(() => {
    if (contentRef.current && page?.headlessContent) executeContentScripts(contentRef.current);
  }, [page?.headlessContent]);

  useEffect(() => {
    if (!page) return undefined;
    const unmountScripts = mountEnqueuedScripts(page.scripts);
    const unmountStyles = mountPageStyles(page.themeStyles);
    return () => {
      unmountScripts();
      unmountStyles();
    };
  }, [page]);

  useEffect(() => {
    if (!page) return;
    page.translations.forEach(({ languageCode: translatedLanguage }) => {
      const translatedBackendCode = languageOptions.find(({ code }) => code === translatedLanguage)?.backendCode
        ?? translatedLanguage.toUpperCase();
      void prefetchIncrementalData(
        `special-page:v5:${pageKey}:${translatedLanguage}:${translatedBackendCode}`,
        () => getSpecialPage(pageKey, translatedLanguage, translatedBackendCode),
      ).catch((preloadError) => {
        console.warn(`Could not preload the ${translatedLanguage.toUpperCase()} ${pageKey} page`, preloadError);
      });
    });
  }, [languageOptions, page, pageKey]);

  const resolvedShortcodeRenderers = { ...WORDPRESS_SHORTCODE_RENDERERS, ...shortcodeRenderers };
  const fallbackContent = renderFallbackShortcodes(resolvedShortcodeRenderers, shortcodeFallbacks, defaultShortcodes);

  if (isLoading) return fallbackContent || (showLoadingState ? <ContentLoadingState label={`Loading ${pageKey} content in ${languageCode.toUpperCase()}`} /> : null);

  if (error) {
    return (
      <>
        <span role="alert" className="sr-only">WordPress content for this special page is unavailable: {error.message}</span>
        {fallbackContent}
      </>
    );
  }

  if (!page) return fallbackContent;

  const description = page.seo.description || page.seo.opengraphDescription || summarizeHtml(page.headlessContent);
  const breadcrumbs = pageKey !== "home"
    ? seoBreadcrumbsToItems(page.seo.breadcrumbs, [{ label: "Home", href: "/" }, { label: page.title }])
    : [];
  const renderedContent = page.headlessShortcodes.length
    ? renderWordPressContent(page.headlessContent, resolvedShortcodeRenderers, shortcodeFallbacks)
    : (
        <>
          {renderWordPressContent(page.headlessContent, resolvedShortcodeRenderers, {})}
          {renderDefaultShortcodes(resolvedShortcodeRenderers, defaultShortcodes)}
        </>
      );

  return (
    <>
      <Seo
        title={page.seo.title || page.title}
        description={description || undefined}
        canonical={page.seo.canonical || page.seo.opengraphUrl || undefined}
        languageCode={page.languageCode}
        keywords={page.seo.keywords || undefined}
        siteName={page.seo.siteName || undefined}
        appendSiteName={false}
        robots={page.seo.robots}
        opengraphType={page.seo.opengraphType === "article" ? "article" : "website"}
        opengraphTitle={page.seo.opengraphTitle || undefined}
        opengraphDescription={page.seo.opengraphDescription || undefined}
        opengraphImage={page.seo.opengraphImage || undefined}
        opengraphPublishedTime={page.seo.opengraphPublishedTime || undefined}
        opengraphModifiedTime={page.seo.opengraphModifiedTime || undefined}
        opengraphAuthor={page.seo.opengraphAuthor || undefined}
        twitterTitle={page.seo.twitterTitle || undefined}
        twitterDescription={page.seo.twitterDescription || undefined}
        schema={{
          pageType: page.seo.pageType || undefined,
          articleType: page.seo.articleType || undefined,
        }}
        breadcrumbs={page.seo.breadcrumbs}
        translations={page.translations.map((translation) => ({
          languageCode: translation.languageCode,
          url: translation.uri,
        }))}
      />

      {breadcrumbs.length > 1 ? <Breadcrumbs items={breadcrumbs} includeStructuredData={false} /> : null}

      {page.headlessContent || renderedContent ? (
        <section
          aria-label={`${page.title} WordPress content`}
          data-wordpress-special-page={pageKey}
          data-wordpress-shortcodes={JSON.stringify(page.headlessShortcodes)}
          className={`funky-wordpress-page-content ${className}`}
        >
          <div
            ref={contentRef}
            className="wp-site-blocks entry-content is-layout-flow grid gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 [&_a]:font-semibold [&_a]:text-brand-600 [&_a]:underline-offset-4 hover:[&_a]:underline dark:[&_a]:text-brand-400 [&_blockquote]:m-0 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-500 [&_blockquote]:pl-5 [&_h2]:m-0 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100 [&_h3]:m-0 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_li]:my-1 [&_ol]:m-0 [&_ol]:pl-5 [&_p]:m-0 [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_ul]:m-0 [&_ul]:pl-5"
          >
            {renderedContent}
          </div>
        </section>
      ) : null}
    </>
  );
}

const SHORTCODE_MARKER_PATTERN = /<div\b[^>]*\bdata-funkycommerce-(?:shortcode|component)=(["'])([^"']+)\1[^>]*>\s*<\/div>/gi;

export function renderWordPressContent(
  html: string,
  renderers: Record<string, WordPressShortcodeRenderer>,
  fallbacks: Record<string, WordPressShortcodeAttributes>,
): ReactNode {
  const nodes: ReactNode[] = [];
  const renderedNames = new Set<string>();
  let cursor = 0;
  let index = 0;

  for (const match of html.matchAll(SHORTCODE_MARKER_PATTERN)) {
    const offset = match.index ?? 0;
    if (offset > cursor) {
      nodes.push(<div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: html.slice(cursor, offset) }} />);
    }
    const name = match[2];
    const renderer = resolveRenderer(renderers, name);
    if (renderer) {
      renderedNames.add(name);
      nodes.push(<div key={`shortcode-${name}-${index}`} data-rendered-wordpress-shortcode={name}>{renderer(parseMarkerAttributes(match[0]))}</div>);
    } else {
      nodes.push(
        <p key={`shortcode-unsupported-${name}-${index}`} role="alert" className="m-0 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          WordPress shortcode [{name}] has no storefront renderer.
        </p>,
      );
    }
    cursor = offset + match[0].length;
    index += 1;
  }

  if (cursor < html.length) {
    nodes.push(<div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: html.slice(cursor) }} />);
  }

  Object.entries(fallbacks).forEach(([name, attributes]) => {
    const renderer = resolveRenderer(renderers, name);
    if (!renderedNames.has(name) && renderer) {
      nodes.push(<div key={`shortcode-fallback-${name}`} data-rendered-wordpress-shortcode={name}>{renderer(attributes)}</div>);
    }
  });

  return nodes.length ? nodes : null;
}

function parseMarkerAttributes(marker: string): WordPressShortcodeAttributes {
  const attributes: WordPressShortcodeAttributes = {};
  for (const match of marker.matchAll(/\bdata-([a-z0-9-]+)=(["'])(.*?)\2/gi)) {
    if (match[1] !== "funkycommerce-shortcode" && match[1] !== "funkycommerce-component") attributes[match[1]] = decodeHtml(match[3]);
  }
  return attributes;
}

function decodeHtml(value: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function renderFallbackShortcodes(
  renderers: Record<string, WordPressShortcodeRenderer>,
  fallbacks: Record<string, WordPressShortcodeAttributes>,
  defaults: { name: string; attributes: WordPressShortcodeAttributes }[],
): ReactNode {
  const nodes = Object.entries(fallbacks).flatMap(([name, attributes]) => {
    const renderer = renderers[name];
    return renderer ? [<div key={`shortcode-fallback-${name}`} data-rendered-wordpress-shortcode={name}>{renderer(attributes)}</div>] : [];
  });
  return nodes.length ? nodes : renderDefaultShortcodes(renderers, defaults);
}

function renderDefaultShortcodes(
  renderers: Record<string, WordPressShortcodeRenderer>,
  defaults: { name: string; attributes: WordPressShortcodeAttributes }[],
): ReactNode {
  const nodes = defaults.flatMap(({ name, attributes }, index) => {
    const renderer = resolveRenderer(renderers, name);
    return renderer ? [<div key={`shortcode-default-${name}-${index}`} data-rendered-wordpress-shortcode={name}>{renderer(attributes)}</div>] : [];
  });
  return nodes.length ? <div className="grid gap-10">{nodes}</div> : null;
}

function resolveRenderer(
  renderers: Record<string, WordPressShortcodeRenderer>,
  name: string,
): WordPressShortcodeRenderer | undefined {
  const normalizedName = normalizeShortcodeName(name);
  return renderers[name] || renderers[normalizedName];
}

function normalizeShortcodeName(name: string): string {
  const stripped = name.replace(/^(funkycommerce_|woocommerce_)/, "");
  return stripped === "my_account" ? "account" : stripped;
}


function summarizeHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
