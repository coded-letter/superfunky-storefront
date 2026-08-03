import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Seo, useLanguage } from "@funky/ui";
import { Breadcrumbs, seoBreadcrumbsToItems } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { APPLICATION_SHORTCODE_RENDERERS } from "../components/applicationShortcodeRenderers";
import { renderWordPressContent } from "../components/WordPressSpecialPageContent";
import { WORDPRESS_SHORTCODE_RENDERERS } from "../components/wordpressShortcodes";
import { useIncrementalData } from "../lib/incrementalData";
import { executeContentScripts, mountEnqueuedScripts } from "../lib/pageScripts";
import { mountPageStyles } from "../lib/pageStyles";
import { getPageByUri } from "../lib/pages";

export function PageMockupPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { languageCode, hasLanguagePreference, syncLanguageCode } = useLanguage();
  const pageUri = normalizePageUri(pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: page, isLoading, error } = useIncrementalData(`page:${pageUri}`, () => getPageByUri(pageUri));

  useEffect(() => {
    if (!page) return;
    if (!hasLanguagePreference) {
      syncLanguageCode(page.languageCode);
      return;
    }
    if (page.languageCode.toLowerCase() === languageCode.toLowerCase()) return;
    const translation = page.translations.find(({ languageCode: translatedLanguage }) => translatedLanguage.toLowerCase() === languageCode.toLowerCase());
    if (translation) {
      const translationPath = toInternalPath(translation.uri);
      if (translationPath !== pathname) navigate(translationPath);
    }
  }, [hasLanguagePreference, languageCode, navigate, page, pathname, syncLanguageCode]);

  useEffect(() => {
    if (!page || !contentRef.current) return;
    executeContentScripts(contentRef.current);
    const unmountScripts = mountEnqueuedScripts(page.scripts);
    const unmountStyles = mountPageStyles(page.themeStyles);
    return () => {
      unmountScripts();
      unmountStyles();
    };
  }, [page]);

  if (isLoading) {
    return <ContentLoadingState label="Loading page" />;
  }
  if (error) {
    return <PageStatus title="Page unavailable" message={error.message} />;
  }
  if (!page) {
    return <PageStatus title="Page not found" message={`WordPress has no published page at “${pageUri}”.`} />;
  }

  const opengraphType = page.seo.opengraphType === "article" ? "article" : "website";
  const renderedContent = page.headlessContent || page.content;
  const description = page.seo.description || page.seo.opengraphDescription || summarizeHtml(renderedContent);
  const breadcrumbs = seoBreadcrumbsToItems(page.seo.breadcrumbs, [{ label: "Home", href: "/" }, { label: page.title }]);

  return (
    <div className="grid gap-6">
      <Seo
        title={page.seo.title || page.title}
        description={description || undefined}
        canonical={page.seo.canonical || page.seo.opengraphUrl || undefined}
        languageCode={page.languageCode}
        keywords={page.seo.keywords || undefined}
        siteName={page.seo.siteName || undefined}
        appendSiteName={false}
        robots={page.seo.robots}
        opengraphType={opengraphType}
        opengraphTitle={page.seo.opengraphTitle || undefined}
        opengraphDescription={page.seo.opengraphDescription || undefined}
        opengraphImage={page.seo.opengraphImage || page.featuredImage?.sourceUrl || undefined}
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

      <Breadcrumbs items={breadcrumbs} includeStructuredData={false} />

      <article className="grid w-full gap-8">
        <div
          ref={contentRef}
          className="wp-site-blocks entry-content is-layout-flow grid gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 [&_a]:font-semibold [&_a]:text-brand-600 [&_a]:underline-offset-4 hover:[&_a]:underline dark:[&_a]:text-brand-400 [&_blockquote]:m-0 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-500 [&_blockquote]:pl-5 [&_h2]:m-0 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100 [&_h3]:m-0 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_li]:my-1 [&_ol]:m-0 [&_ol]:pl-5 [&_p]:m-0 [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_ul]:m-0 [&_ul]:pl-5"
        >
          {renderWordPressContent(renderedContent, { ...WORDPRESS_SHORTCODE_RENDERERS, ...APPLICATION_SHORTCODE_RENDERERS }, {})}
        </div>
      </article>
    </div>
  );
}

function toInternalPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function normalizePageUri(pathname: string): string {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function summarizeHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const text = document.body.textContent?.replace(/\s+/g, " ").trim() || "";
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

function PageStatus({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to="/" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to home
      </Link>
    </section>
  );
}
