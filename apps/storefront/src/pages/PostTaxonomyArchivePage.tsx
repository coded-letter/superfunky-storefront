import { useEffect, useRef, type RefObject } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PaginablePostGrid, Seo, useLanguage, useLayoutPreferences } from "@funky/ui";
import { Breadcrumbs, type BreadcrumbItem } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { HeroMock } from "../components/HeroMock";
import { useIncrementalData } from "@funky/sdk/react";
import { mountCmsBehaviors } from "../lib/cmsBehaviors";
import { mountEnqueuedScripts } from "../lib/pageScripts";
import { useStorefrontPath } from "../lib/storefrontPaths";
import {
  getPostTaxonomyArchive,
  type CmsPostArchive,
  type PostTaxonomy,
  type TaxonomyIdentifierType,
} from "../lib/postArchives";
import { ArchiveDescriptionSection } from "./shared";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";

export function PostTaxonomyArchivePage({ taxonomy }: { taxonomy: PostTaxonomy }) {
  const { pathname } = useLocation();
  const { slug = "" } = useParams();
  const legacyPrefix = taxonomy === "category" ? "/blog/category/" : "/blog/tag/";
  const idType: TaxonomyIdentifierType = pathname.startsWith(legacyPrefix) ? "SLUG" : "URI";
  const identifier = idType === "SLUG" ? slug : normalizeUri(pathname);

  return (
    <PostTaxonomyArchiveLoader
      key={`${taxonomy}:${idType}:${identifier}`}
      taxonomy={taxonomy}
      identifier={identifier}
      idType={idType}
      pathname={pathname}
    />
  );
}

function PostTaxonomyArchiveLoader({
  taxonomy,
  identifier,
  idType,
  pathname,
}: {
  taxonomy: PostTaxonomy;
  identifier: string;
  idType: TaxonomyIdentifierType;
  pathname: string;
}) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  const { languageCode } = useLanguage();
  const lastResolvedArchive = useRef<CmsPostArchive | null>(null);
  const { data: archive, isLoading, isRevalidating, error } = useIncrementalData(
    `post-${taxonomy}-archive:${idType}:${identifier}:${languageCode}`,
    () => getPostTaxonomyArchive(taxonomy, identifier, idType, languageCode),
  );
  if (archive) lastResolvedArchive.current = archive;

  useCanonicalContentLanguage(
    archive?.languageCode || lastResolvedArchive.current?.languageCode,
    archive?.translations || lastResolvedArchive.current?.translations || [],
    pathname,
    !isLoading && !isRevalidating,
    true,
    archive?.uri || lastResolvedArchive.current?.uri,
  );

  useEffect(() => {
    if (!archive) return;
    const unmountBehaviors = descriptionRef.current ? mountCmsBehaviors(descriptionRef.current) : () => undefined;
    const unmountScripts = mountEnqueuedScripts(archive.scripts);
    return () => {
      unmountBehaviors();
      unmountScripts();
    };
  }, [archive]);

  if (isLoading) {
    return <ContentLoadingState label={`Loading ${taxonomy} archive`} />;
  }
  if (error) {
    return <ArchiveStatus title={`${capitalize(taxonomy)} unavailable`} message="This collection is temporarily unavailable." />;
  }
  if (!archive) {
    return <ArchiveStatus title={`${capitalize(taxonomy)} not found`} message="This collection is unavailable." />;
  }

  return <PostTaxonomyArchive archive={archive} descriptionRef={descriptionRef} />;
}

function PostTaxonomyArchive({
  archive,
  descriptionRef,
}: {
  archive: CmsPostArchive;
  descriptionRef: RefObject<HTMLDivElement>;
}) {
  const { postArchiveHeroLayout: heroVariant, showArchiveDescriptionInHero } = useLayoutPreferences();
  const isFullBleed = heroVariant === "fullbleed";
  const blogPath = useStorefrontPath("blog", "/blog");
  const isTag = archive.taxonomy === "tag";
  const displayTitle = isTag ? `#${archive.name}` : archive.name;
  const descriptionText =
    htmlToText(archive.descriptionHtml) ||
    (isTag
      ? `Browse every published post tagged #${archive.name.toLowerCase()}.`
      : `Explore published stories filed under ${archive.name.toLowerCase()}.`);
  const breadcrumbs = getVisibleBreadcrumbs(archive, blogPath);
  const heroImage = archive.posts.find(({ imageUrl }) => imageUrl)?.imageUrl;

  return (
    <div className={`grid gap-8 ${isFullBleed ? "relative" : ""}`}>
      <Seo
        title={archive.seo.title || displayTitle}
        description={archive.seo.description || descriptionText}
        canonical={archive.seo.canonical || archive.seo.opengraphUrl || undefined}
        languageCode={archive.languageCode}
        keywords={archive.seo.keywords || undefined}
        siteName={archive.seo.siteName || undefined}
        appendSiteName={false}
        robots={archive.seo.robots}
        opengraphType="website"
        opengraphTitle={archive.seo.opengraphTitle || undefined}
        opengraphDescription={archive.seo.opengraphDescription || undefined}
        opengraphImage={archive.seo.opengraphImage || heroImage}
        twitterTitle={archive.seo.twitterTitle || undefined}
        twitterDescription={archive.seo.twitterDescription || undefined}
        breadcrumbs={archive.seo.breadcrumbs}
        translations={archive.translations.map((translation) => ({
          languageCode: translation.languageCode,
          url: translation.uri,
        }))}
      />

      <div className={isFullBleed ? "absolute left-0 top-4 z-20 text-white [&_a]:text-white/80 [&_span]:text-white/70" : ""}>
        <Breadcrumbs items={breadcrumbs} includeStructuredData={false} />
      </div>

      <div className="grid gap-3">
        <HeroMock
          variant={heroVariant}
          headingLevel="h1"
          kicker={capitalize(archive.taxonomy)}
          title={displayTitle}
          description={showArchiveDescriptionInHero ? descriptionText : undefined}
          image={heroImage}
          fullWidth={isFullBleed}
          secondaryCta={{ label: "All posts", href: blogPath }}
        />
      </div>

      {archive.terms.length > 1 ? (
        <nav aria-label={`${capitalize(archive.taxonomy)} archives`} className="flex flex-wrap gap-2">
          {archive.terms.map((term) => (
            <Link
              key={term.id}
              to={toInternalPath(term.uri)}
              aria-current={term.id === archive.id ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium no-underline transition ${
                term.id === archive.id
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {isTag ? "#" : ""}
              {term.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {archive.posts.length ? (
        <PaginablePostGrid
          key={archive.id}
          title={isTag ? `Tagged #${archive.name}` : `${archive.name} posts`}
          posts={archive.posts}
          pageSize={6}
          cardVariant="default"
          gridVariant="standard"
        />
      ) : (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No published posts are connected to this {archive.taxonomy}.
        </p>
      )}

      {archive.hasMorePosts ? (
        <p className="m-0 text-center text-xs text-zinc-500 dark:text-zinc-400">
          This archive contains more posts than this page currently shows.
        </p>
      ) : null}

      {archive.descriptionHtml ? (
        <div ref={descriptionRef}>
          <ArchiveDescriptionSection
            eyebrow={capitalize(archive.taxonomy)}
            title={displayTitle}
            image={heroImage}
            html={archive.descriptionHtml}
          />
        </div>
      ) : null}
    </div>
  );
}

function getVisibleBreadcrumbs(archive: CmsPostArchive, blogPath: string): BreadcrumbItem[] {
  if (archive.seo.breadcrumbs.length > 0) {
    return archive.seo.breadcrumbs.map((breadcrumb, index, all) => ({
      label: breadcrumb.name,
      href: index === all.length - 1 ? undefined : toInternalPath(breadcrumb.url),
    }));
  }
  return [{ label: "Home", href: "/" }, { label: "Blog", href: blogPath }, { label: archive.name }];
}

function ArchiveStatus({ title, message }: { title: string; message: string }) {
  const blogPath = useStorefrontPath("blog", "/blog");
  return (
    <section className="mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to={blogPath} className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to blog
      </Link>
    </section>
  );
}

function normalizeUri(pathname: string): string {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function toInternalPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
