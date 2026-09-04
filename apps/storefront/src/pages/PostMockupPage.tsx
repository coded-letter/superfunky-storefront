import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { ResponsiveImage, Seo, useLanguage, useLayoutPreferences, useT } from "@funky/ui";
import { Breadcrumbs, type BreadcrumbItem } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { GuestStarRating } from "../components/GuestStarRating";
import { renderCmsContent } from "../components/CmsPageContent";
import { WORDPRESS_SHORTCODE_RENDERERS } from "../components/wordpressShortcodes";
import { APPLICATION_SHORTCODE_RENDERERS } from "../components/applicationShortcodeRenderers";
import { useIncrementalData } from "@funky/sdk/react";
import { mountCmsBehaviors, sanitizeCmsHtml } from "../lib/cmsBehaviors";
import { mountEnqueuedScripts } from "../lib/pageScripts";
import { mountPageStyles } from "../lib/pageStyles";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { getPostByUri, type CmsPost } from "../lib/posts";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { createReview } from "../lib/comments";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";
import { backendPostUriFromStorefrontPath } from "../lib/postRoutePaths.mjs";
import { resolveConfiguredContentLanguage } from "../lib/contentLanguageFallback";
import { CommentsSection, stringToHSL, summarizeReviews } from "./CommentThread";
import { ShareButtonsRow } from "./ShareButtons";
import { slugifyHeading } from "./shared";


type TocLayout = "current" | "rail-left" | "rail-right" | "above";
type SharePosition = "above-toc" | "on-image" | "below-toc-right";
type AuthorLayout = "fullwidth" | "compact" | "editorial";

/**
 * Post template — ported from the legacy Gatsby prototype's `templates/blog-post.js`,
 * preserving its full feature set: category/tag pills, a featured image with a
 * floating share row, an auto-generated table of contents with anchor-linked headings
 * (`toc.js` / `anchors-content.js`), a rating-summary jump link (`post-reviews-summary.js`),
 * an author bio card (`bio.js`), a threaded comments section (`review-form.js` /
 * `reviews-list.js` — here upgraded with real nested replies, see `CommentThread.tsx`),
 * and WordPress-rendered content with anchor-linked headings.
 */
export function PostMockupPage({ fallback }: { fallback?: ReactNode } = {}) {
  const t = useT();
  const { pathname } = useLocation();
  const { showCodeControls } = useLayoutPreferences();
  const { languageCode, configuredLanguageCodes } = useLanguage();
  const postUri = backendPostUriFromStorefrontPath(pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: post, isLoading, isRevalidating, error } = useIncrementalData(
    `post:${postUri}`,
    () => getPostByUri(postUri),
  );
  const contentLanguageCode = resolveConfiguredContentLanguage(
    post?.languageCode,
    languageCode,
    configuredLanguageCodes,
  );

  useCanonicalContentLanguage(
    contentLanguageCode,
    post?.translations || [],
    pathname,
    !isLoading && !isRevalidating,
    true,
    post?.uri,
  );

  useEffect(() => {
    if (!post || !contentRef.current) return;
    const unmountBehaviors = mountCmsBehaviors(contentRef.current, showCodeControls);
    const unmountScripts = mountEnqueuedScripts(post.scripts);
    return () => {
      unmountBehaviors();
      unmountScripts();
    };
  }, [post, showCodeControls]);

  useLayoutEffect(() => {
    if (!post) return undefined;
    return mountPageStyles(post.themeStyles, BACKEND_ORIGIN);
  }, [post?.themeStyles]);

  if (isLoading) return <ContentLoadingState label={t("loading.post")} />;
  if (error) return <PostStatus title={t("error.post_unavailable")} message={error.message} />;
  if (!post) {
    return fallback ?? <PostStatus title={t("post.not_found")} message={t("post.not_found_message", { uri: postUri })} />;
  }

  return (
    <PostMockupPageInner
      post={post}
      contentRef={contentRef}
      languageCode={contentLanguageCode}
    />
  );
}

function PostMockupPageInner({
  post,
  contentRef,
  languageCode,
}: {
  post: CmsPost;
  contentRef: RefObject<HTMLDivElement>;
  languageCode: string;
}) {
  const t = useT();
  const blogPath = useStorefrontPath("blog", "/blog");
  const { postTocLayout: tocLayout, postSharePosition: sharePosition, postAuthorLayout: authorLayout, discussionLayout } =
    useLayoutPreferences();

  const preparedContent = useMemo(() => preparePostContent(post.content), [post.content]);
  const tocEntries = preparedContent.entries;
  const breadcrumbs = getVisibleBreadcrumbs(post, blogPath, t("nav.home"), t("nav.blog"));
  const description = post.seo.description || post.seo.opengraphDescription || post.excerpt;
  const reviewSummary = summarizeReviews(post.comments);

  return (
    <div className="grid gap-10">
      <Seo
        title={post.seo.title || post.title}
        description={description || undefined}
        canonical={post.seo.canonical || post.seo.opengraphUrl || undefined}
        languageCode={languageCode}
        keywords={post.seo.keywords || undefined}
        siteName={post.seo.siteName || undefined}
        appendSiteName={false}
        robots={post.seo.robots}
        opengraphType="article"
        opengraphTitle={post.seo.opengraphTitle || undefined}
        opengraphDescription={post.seo.opengraphDescription || undefined}
        image={post.featuredImage
          ? {
              url: post.featuredImage.sourceUrl,
              alt: post.featuredImage.altText || post.title,
              width: post.featuredImage.width,
              height: post.featuredImage.height,
            }
          : post.seo.opengraphImage
            ? { url: post.seo.opengraphImage, alt: post.title }
            : undefined}
        opengraphPublishedTime={post.seo.opengraphPublishedTime || post.date}
        opengraphModifiedTime={post.seo.opengraphModifiedTime || post.modified || undefined}
        opengraphAuthor={post.seo.opengraphAuthor || post.author.name}
        opengraphPublisher={post.seo.opengraphPublisher || undefined}
        articleSection={post.categories[0]?.name}
        articleTags={post.tags.map((tag) => tag.name)}
        twitterTitle={post.seo.twitterTitle || undefined}
        twitterDescription={post.seo.twitterDescription || undefined}
        schema={{
          pageType: post.seo.pageType || undefined,
          articleType: post.seo.articleType || "Article",
        }}
        breadcrumbs={post.seo.breadcrumbs}
        translations={post.translations.map((translation) => ({
          languageCode: translation.languageCode,
          url: translation.uri,
        }))}
      />
      <Breadcrumbs items={breadcrumbs} includeStructuredData={false} />

      <article itemScope itemType="https://schema.org/Article" className="grid gap-8">
        <header className="grid gap-4">
          {post.categories.length ? (
            <div className="flex flex-wrap gap-2">
              {post.categories.map((category) => (
                <Link
                  key={category.slug}
                  to={toInternalPath(category.uri)}
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 no-underline transition hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}

          <h1 itemProp="headline" className="m-0 text-3xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              {new Date(post.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {post.wordCount} words · {post.readingTimeMinutes} min read
            </span>
          </div>

          <GuestStarRating
            targetType="post"
            targetId={post.databaseId}
            initialSummary={post.engagementRating}
          />

          {post.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag.slug}
                  to={toInternalPath(tag.uri)}
                  className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 no-underline transition hover:bg-blue-200 dark:bg-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-700"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        <div className="relative overflow-hidden rounded-3xl shadow-soft-lg">
          {post.featuredImage ? (
            <ResponsiveImage
              src={post.featuredImage.sourceUrl}
              alt={post.featuredImage.altText}
              width={post.featuredImage.width}
              height={post.featuredImage.height}
              srcSet={post.featuredImage.srcSet}
              priority
              sizes="100vw"
              className="aspect-[21/9] min-h-[400px] w-full object-cover md:min-h-0"
            />
          ) : (
            <div className="aspect-[21/9] min-h-[400px] w-full bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-950 md:min-h-0" />
          )}
          {sharePosition === "on-image" ? (
            <div className="absolute bottom-4 right-4">
              <ShareButtonsRow title={post.title} variant="on-image" />
            </div>
          ) : null}
        </div>

        {tocLayout === "rail-left" || tocLayout === "rail-right" ? (
          <TocDotRail entries={tocEntries} side={tocLayout === "rail-right" ? "right" : "left"} />
        ) : null}

        <div className={tocLayout === "current" ? "grid gap-8 lg:grid-cols-[240px_1fr]" : "grid gap-8"}>
          {tocLayout === "current" ? (
            <div className="order-2 lg:order-1">
              <div className={`grid gap-4 lg:sticky ${sharePosition === "on-image" ? "lg:top-0" : "lg:top-28"}`}>
                {sharePosition === "above-toc" && (
                  <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
                    <ShareButtonsRow title={post.title} />
                  </div>
                )}
                {tocEntries.length ? <TableOfContents entries={tocEntries} /> : null}
                {sharePosition === "below-toc-right" && (
                  <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
                    <ShareButtonsRow title={post.title} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {(tocLayout === "rail-left" || tocLayout === "rail-right") && sharePosition !== "on-image" ? (
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
              <ShareButtonsRow title={post.title} />
            </div>
          ) : null}
          {tocLayout === "above" && tocEntries.length ? (
            <div className="grid gap-4">
              <TableOfContents entries={tocEntries} />
              {sharePosition !== "on-image" ? (
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
                  <ShareButtonsRow title={post.title} />
                </div>
              ) : null}
            </div>
          ) : null}
          <PostContentBody
            contentRef={contentRef}
            html={preparedContent.html}
            className={tocLayout === "current" ? "order-1 lg:order-2" : undefined}
          />
        </div>

        <footer className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <AuthorBio author={post.author} layout={authorLayout} />
        </footer>
      </article>

      <CommentsSection
        anchorId="opinions"
        contentKey={`post:${post.id}`}
        heading={t("comment.section_heading")}
        key={post.id}
        initialReviews={post.comments}
        averageRating={reviewSummary.averageRating}
        ratingHistogram={reviewSummary.averageRating ? reviewSummary.histogram : undefined}
        totalCountOverride={post.comments.length}
        formTitle={t("comment.form_title")}
        formNote={t("comment.form_note")}
        showRatingField={false}
        discussionLayout={discussionLayout}
        onSubmitReview={(review) => createReview({
          commentOn: post.databaseId,
          author: review.author,
          authorEmail: review.email,
          content: review.content,
        })}
        onSubmitReply={(parent, reply) => {
          if (!parent.databaseId) throw new Error("This comment cannot be replied to because its content ID is unavailable.");
          return createReview({
            commentOn: post.databaseId,
            author: reply.author,
            authorEmail: reply.email,
            content: reply.content,
            parent: parent.databaseId,
          });
        }}
      />
    </div>
  );
}

type TocEntry = { id: string; text: string; level: 2 | 3 | 4 | 5 | 6 };

function preparePostContent(html: string): { html: string; entries: TocEntry[] } {
  const document = new DOMParser().parseFromString(sanitizeCmsHtml(html), "text/html");
  const usedIds = new Set<string>();
  const entries = Array.from(document.body.querySelectorAll("h2, h3, h4, h5, h6")).flatMap((heading) => {
    const text = heading.textContent?.trim();
    if (!text) return [];
    const level = Number(heading.tagName.slice(1)) as TocEntry["level"];
    const baseId = heading.id || slugifyHeading(text);
    let id = baseId || "section";
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;
    heading.classList.add("scroll-mt-28");
    return [{ id, text, level }];
  });
  return { html: document.body.innerHTML, entries };
}

/** Shared scroll-tracking for both the sidebar `TableOfContents` and the `TocDotRail`
 * "hidden" layout — the active heading is the last one (in document order) that has
 * already scrolled past a fixed offset under the sticky header, i.e. the section
 * currently under the reader. */
function useActiveHeading(entries: TocEntry[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (!entries.length) return undefined;

    const headingElements = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    if (!headingElements.length) return undefined;

    // Matches the sticky header's height (and the headings' own `scroll-mt-28`) so a
    // section becomes "active" right as it scrolls up to sit just under the header —
    // not only once it reaches the very top edge of the viewport.
    const ACTIVE_OFFSET_PX = 120;

    let frame = 0;
    const updateActiveHeading = () => {
      frame = 0;
      let current = headingElements[0].id;
      for (const element of headingElements) {
        if (element.getBoundingClientRect().top <= ACTIVE_OFFSET_PX) {
          current = element.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [entries]);

  return activeId;
}

function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const activeId = useActiveHeading(entries);

  return (
    <nav
      aria-label="Table of contents"
      className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Table of contents
      </span>
      <ul className="m-0 grid list-none gap-1 p-0 text-sm">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id} style={{ marginLeft: (entry.level - 2) * 16 }}>
              <a
                href={`#${entry.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`block rounded-lg px-3 py-1.5 transition ${
                  isActive
                    ? "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-zinc-600 hover:bg-zinc-200/60 hover:text-brand-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-brand-400"
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Hidden" TOC layout: a slim rail of dots stuck to the left edge of the viewport
 * (one per heading, all in a single straight line — no per-level indentation, unlike
 * the sidebar TOC), expanding into the full heading labels on hover/focus — a
 * genuinely new pattern (not a variant of the existing sidebar TOC), fixed-position so
 * it stays reachable regardless of scroll position. The dot for the heading currently
 * in view is highlighted exactly like the sidebar TOC's active entry (shares the same
 * `useActiveHeading` scroll tracking). Renders nothing if there are no headings. */
function TocDotRail({ entries, side }: { entries: TocEntry[]; side: "left" | "right" }) {
  const activeId = useActiveHeading(entries);
  if (!entries.length) return null;

  return (
    <div className={`group/toc fixed top-1/2 z-30 hidden -translate-y-1/2 lg:block ${side === "right" ? "right-0" : "left-0"}`}>
      <div className={`grid gap-2 border border-zinc-200/80 bg-white/90 py-3 shadow-soft backdrop-blur transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900/90 ${
        side === "right"
          ? "rounded-l-2xl border-r-0 pl-1.5 pr-2 group-hover/toc:pl-3"
          : "rounded-r-2xl border-l-0 pl-2 pr-1.5 group-hover/toc:pr-3"
      }`}>
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <a key={entry.id} href={`#${entry.id}`} className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`} aria-label={entry.text} aria-current={isActive ? "location" : undefined}>
              <span
                className={`h-2 w-2 shrink-0 rounded-full transition ${
                  isActive ? "bg-brand-600 dark:bg-brand-400" : "bg-zinc-300 group-hover/toc:bg-brand-300 dark:bg-zinc-700"
                }`}
              />
              <span
                className={`max-w-0 overflow-hidden whitespace-nowrap text-xs opacity-0 transition-all duration-200 group-hover/toc:max-w-[200px] group-hover/toc:opacity-100 ${
                  isActive ? "font-semibold text-brand-700 dark:text-brand-300" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {entry.text}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function PostContentBody({
  contentRef,
  html,
  className,
}: {
  contentRef: RefObject<HTMLDivElement>;
  html: string;
  className?: string;
}) {
  return (
    <div
      ref={contentRef}
      itemProp="articleBody"
      className={`wp-site-blocks entry-content is-layout-flow grid gap-5 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 ${className ?? ""}`}
    >
      {renderCmsContent(
        html,
        { ...WORDPRESS_SHORTCODE_RENDERERS, ...APPLICATION_SHORTCODE_RENDERERS },
      )}
    </div>
  );
}

function AuthorBio({ author, layout = "fullwidth" }: { author: CmsPost["author"]; layout?: AuthorLayout }) {
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nameLink = author.uri ? (
    <Link
      to={toInternalPath(author.uri)}
      className="w-fit font-display text-lg font-semibold text-zinc-900 no-underline transition hover:text-brand-600 hover:underline dark:text-zinc-100 dark:hover:text-brand-400"
    >
      {author.name}
    </Link>
  ) : (
    <span className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{author.name}</span>
  );

  const avatar = (size: string) =>
    author.avatarUrl ? (
      <ResponsiveImage src={author.avatarUrl} alt="" sizes="5rem" className={`shrink-0 rounded-full object-cover ${size}`} />
    ) : (
      <span
        className={`inline-grid shrink-0 place-items-center rounded-full text-lg font-semibold text-white ${size}`}
        style={{ backgroundColor: stringToHSL(author.name) }}
        aria-hidden="true"
      >
        {initials}
      </span>
    );

  if (layout === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        {avatar("h-10 w-10 text-sm")}
        <div className="flex flex-wrap items-baseline gap-x-2">
          {nameLink}
          {author.uri ? (
            <Link
              to={toInternalPath(author.uri)}
              className="text-xs font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400"
            >
              Read all articles →
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (layout === "editorial") {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-6 py-8 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        {avatar("h-20 w-20 text-2xl")}
        <div className="grid justify-items-center gap-1.5">
          {nameLink}
          {author.bio ? <p className="m-0 max-w-md text-sm italic leading-relaxed text-zinc-500 dark:text-zinc-400">{author.bio}</p> : null}
          {author.uri ? (
            <Link
              to={toInternalPath(author.uri)}
              className="mt-1 w-fit text-xs font-semibold uppercase tracking-wide text-brand-600 no-underline hover:underline dark:text-brand-400"
            >
              Read all articles by {author.name} →
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft transition hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:flex-nowrap">
      {avatar("h-16 w-16")}
      <div className="grid gap-1">
        {nameLink}
        {author.bio ? <p className="m-0 text-sm leading-snug text-zinc-500 dark:text-zinc-400">{author.bio}</p> : null}
        {author.uri ? (
          <Link
            to={toInternalPath(author.uri)}
            className="mt-1 w-fit text-xs font-semibold text-brand-600 no-underline transition hover:underline dark:text-brand-400"
          >
            Read all articles by {author.name} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function getVisibleBreadcrumbs(post: CmsPost, blogPath: string, homeLabel: string, blogLabel: string): BreadcrumbItem[] {
  if (post.seo.breadcrumbs.length > 0) {
    return post.seo.breadcrumbs.map((breadcrumb, index, all) => ({
      label: breadcrumb.name,
      href: index === all.length - 1 ? undefined : toInternalPath(breadcrumb.url),
    }));
  }
  return [
    { label: homeLabel, href: "/" },
    { label: blogLabel, href: blogPath },
    ...(post.categories[0] ? [{ label: post.categories[0].name, href: toInternalPath(post.categories[0].uri) }] : []),
    { label: post.title },
  ];
}

function toInternalPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function PostStatus({ title, message }: { title: string; message: string }) {
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
