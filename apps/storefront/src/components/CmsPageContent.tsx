import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Seo, useLanguage } from "@funky/ui";
import { Breadcrumbs, seoBreadcrumbsToItems } from "./Breadcrumbs";
import { useIncrementalData } from "@funky/sdk/react";
import { mountCmsBehaviors, sanitizeCmsHtml } from "../lib/cmsBehaviors";
import { mountEnqueuedScripts } from "../lib/pageScripts";
import { mountPageStyles } from "../lib/pageStyles";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { getPageByUri, type CmsPage } from "../lib/pages";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";
import {
  WORDPRESS_SHORTCODE_RENDERERS,
  type WordPressShortcodeRenderer,
} from "./wordpressShortcodes";
import { ContentLoadingState } from "./ContentLoadingState";
import {
  normalizeShortcodeName,
  normalizeRenderedShortcodeOutput,
  recoverRawShortcodeAttributes,
  normalizeSupportedShortcodes,
  slotRenderableShortcodeMarkers,
  type SlottedShortcodeMarker,
} from "../lib/shortcodeMarkup";

type CmsPageContentProps = {
  className?: string;
  fallback?: ReactNode;
  emptyFallback?: ReactNode;
  loadPage?: () => Promise<CmsPage | null>;
  pageCacheKey?: string;
  rootId?: string;
  robots?: string;
  shortcodeRenderers?: Record<string, WordPressShortcodeRenderer>;
  synchronizeLanguage?: boolean;
};

export function CmsPageContent({
  className = "",
  fallback,
  emptyFallback,
  loadPage,
  pageCacheKey,
  rootId,
  robots,
  shortcodeRenderers = {},
  synchronizeLanguage = true,
}: CmsPageContentProps) {
  const { pathname } = useLocation();
  const { configuredLanguageCodes } = useLanguage();
  const pageUri = normalizePageUri(pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: page, isLoading, isRevalidating, error } = useIncrementalData(
    pageCacheKey || `page:${pageUri}`,
    loadPage || (() => getPageByUri(pageUri)),
  );
  useCanonicalContentLanguage(
    synchronizeLanguage ? page?.languageCode : undefined,
    synchronizeLanguage ? page?.translations || [] : [],
    pathname,
    !isLoading && !isRevalidating,
  );

  useEffect(() => {
    if (contentRef.current && page?.headlessContent) return mountCmsBehaviors(contentRef.current);
    return undefined;
  }, [page?.headlessContent]);

  useEffect(() => {
    if (!page) return undefined;
    const unmountScripts = mountEnqueuedScripts(page.scripts);
    const unmountStyles = mountPageStyles(page.themeStyles, BACKEND_ORIGIN);
    return () => {
      unmountScripts();
      unmountStyles();
    };
  }, [page]);

  const resolvedShortcodeRenderers = { ...WORDPRESS_SHORTCODE_RENDERERS, ...shortcodeRenderers };

  if (isLoading) return <ContentLoadingState label="Loading page" />;

  if (error) {
    if (fallback !== undefined) return fallback;
    return <PageStatus title="Page unavailable" message={error.message} />;
  }

  if (!page) {
    if (fallback !== undefined) return fallback;
    return <PageStatus title="Page not found" message="This page is unavailable." />;
  }

  const description = page.seo.description || page.seo.opengraphDescription || summarizeHtml(page.headlessContent);
  const homePath = isHomePath(pathname, configuredLanguageCodes);
  const breadcrumbs = homePath
    ? []
    : seoBreadcrumbsToItems(page.seo.breadcrumbs, [{ label: "Home", href: "/" }, { label: page.title }]);
  const renderedContent = renderCmsContent(
    page.headlessContent || page.content,
    resolvedShortcodeRenderers,
    page.headlessShortcodes,
  );
  const hasRenderedContent = Boolean(page.headlessContent || page.content || renderedContent);
  return (
    <>
      <Seo
        title={page.seo.title || page.title}
        description={description || undefined}
        canonical={homePath
          ? `${window.location.origin}${pathname === "/" ? "" : pathname.replace(/\/+$/, "")}`
          : page.seo.canonical || page.seo.opengraphUrl || `${window.location.origin}${pathname}`}
        languageCode={page.languageCode}
          keywords={page.seo.keywords || undefined}
          siteName={page.seo.siteName || undefined}
          appendSiteName={false}
          robots={robots || page.seo.robots}
          opengraphType={page.seo.opengraphType === "article" ? "article" : "website"}
          opengraphTitle={page.seo.opengraphTitle || undefined}
          opengraphDescription={page.seo.opengraphDescription || undefined}
          image={page.featuredImage
            ? {
                url: page.featuredImage.sourceUrl,
                alt: page.featuredImage.altText || page.title,
                width: page.featuredImage.width,
                height: page.featuredImage.height,
              }
            : page.seo.opengraphImage
              ? { url: page.seo.opengraphImage, alt: page.title }
              : undefined}
          opengraphPublishedTime={page.seo.opengraphPublishedTime || undefined}
          opengraphModifiedTime={page.seo.opengraphModifiedTime || undefined}
          opengraphAuthor={page.seo.opengraphAuthor || undefined}
          opengraphPublisher={page.seo.opengraphPublisher || undefined}
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

      {hasRenderedContent ? (
        <section
          id={rootId}
          aria-label={`${page.title} content`}
          data-cms-page={page.databaseId}
          data-cms-shortcodes={JSON.stringify(page.headlessShortcodes)}
          className={`sf-cms-page funky-cms-page-content ${className}`}
        >
          <div
            ref={contentRef}
            className="wp-site-blocks entry-content is-layout-flow grid gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
          >
            {renderedContent}
          </div>
        </section>
      ) : emptyFallback || null}
    </>
  );
}

export function renderCmsContent(
  html: string,
  renderers: Record<string, WordPressShortcodeRenderer>,
  rawShortcodes: readonly string[] = [],
): ReactNode {
  html = normalizeRenderedShortcodeOutput(sanitizeCmsHtml(html), Object.keys(renderers), rawShortcodes);
  html = normalizeSupportedShortcodes(html, Object.keys(renderers));
  const slotted = slotRenderableShortcodeMarkers(html);
  const markers = recoverRawShortcodeAttributes(slotted.markers, rawShortcodes);
  const slots = markers.map((marker) => {
    const name = marker.name;
    const renderer = resolveRenderer(renderers, name);
    if (renderer) {
      return {
        marker,
        content: (
          <div
            className={`sf-shortcode sf-shortcode-${normalizeShortcodeName(name).replaceAll("_", "-")}`}
            data-rendered-cms-shortcode={name}
          >
            {renderer(marker.attributes)}
          </div>
        ),
      };
    }
    return {
      marker,
      content: (
        <p role="alert" className="m-0 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Site shortcode [{name}] has no storefront renderer.
        </p>
      ),
    };
  });

  if (!slotted.html) return null;

  return (
    <>
      {slotted.html ? <NestedWordPressShortcodes key={slotted.html} html={slotted.html} slots={slots} /> : null}
    </>
  );
}

type NestedShortcodeSlot = {
  marker: SlottedShortcodeMarker;
  content: ReactNode;
};

function NestedWordPressShortcodes({ html, slots }: { html: string; slots: NestedShortcodeSlot[] }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<(Element | null)[]>([]);

  useLayoutEffect(() => {
    setTargets(slots.map(({ marker }) =>
      contentRef.current?.querySelector(`[data-funkycommerce-render-slot="${marker.slotId}"]`) || null,
    ));
  }, [slots]);

  return (
    <>
      <div ref={contentRef} className="wp-content-fragment" dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map(({ marker, content }, index) =>
        targets[index] ? createPortal(content, targets[index], marker.slotId) : null,
      )}
    </>
  );
}

function resolveRenderer(
  renderers: Record<string, WordPressShortcodeRenderer>,
  name: string,
): WordPressShortcodeRenderer | undefined {
  const normalizedName = normalizeShortcodeName(name);
  return renderers[name] || renderers[normalizedName];
}


function summarizeHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function normalizePageUri(pathname: string): string {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function isHomePath(pathname: string, configuredLanguageCodes: readonly string[]): boolean {
  if (pathname === "/") return true;
  const normalizedPath = pathname.replace(/^\/|\/$/g, "").toLowerCase();
  return configuredLanguageCodes.length >= 2 && configuredLanguageCodes.includes(normalizedPath);
}

function PageStatus({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
    </section>
  );
}
