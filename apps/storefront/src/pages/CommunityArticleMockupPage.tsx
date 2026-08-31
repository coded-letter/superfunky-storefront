import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calendar } from "lucide-react";
import { ResponsiveImage, avatarColorFor, useLayoutPreferences, useT } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ShareButtonsRow } from "./ShareButtons";
import { NotFoundMockupPage } from "./NotFoundMockupPage";
import { CommentsSection } from "./CommentThread";
import { useCreatorContent } from "../state/creatorContent";
import { getCreatorArticleBySlug, getSocialUserByHandle } from "./socialShared";

/**
 * A creator member's own article — the template `PostCard`'s `href` override routes
 * to whenever a card renders a `CREATOR_ARTICLES`/`useCreatorContent().articles` entry
 * instead of a staff blog post. Structurally this is the same WordPress `post` entity
 * as `/blog/:slug` (see `PostMockupPage.tsx`), just authored by a customer account
 * rather than staff, so it reuses `CommentsSection` for discussion exactly the same way.
 */
export function CommunityArticleMockupPage() {
  const t = useT();
  const { handle = "", slug = "" } = useParams();
  const creatorContent = useCreatorContent();
  const { discussionLayout } = useLayoutPreferences();
  const author = getSocialUserByHandle(handle);
  const userArticles = useMemo(
    () => creatorContent.articles.filter((article) => article.vendorHandle === handle),
    [creatorContent.articles, handle],
  );
  const article = getCreatorArticleBySlug(handle, slug, userArticles);

  if (!author || !article) return <NotFoundMockupPage />;

  const paragraphs = (article.body ?? article.excerpt)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const initials = author.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="grid gap-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Community", href: "/community" },
          { label: author.displayName, href: `/community/${author.handle}?tab=articles` },
          { label: article.title },
        ]}
      />

      <Link
        to={`/community/${author.handle}?tab=articles`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        More from @{author.handle}
      </Link>

      <article className="grid gap-6">
        <div className="grid gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {article.categories?.[0]?.name ?? "Community article"}
          </span>
          <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-4xl">{article.title}</h1>
          <p className="m-0 max-w-2xl text-base text-zinc-500 dark:text-zinc-400">{article.excerpt}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-zinc-200 py-4 dark:border-zinc-800">
          <Link to={`/community/${author.handle}`} className="inline-flex items-center gap-3 no-underline">
            {author.avatarUrl ? (
              <ResponsiveImage src={author.avatarUrl} alt="" sizes="2.75rem" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: avatarColorFor(author.displayName) }}
                aria-hidden="true"
              >
                {initials}
              </span>
            )}
            <span className="grid">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{author.displayName}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">@{author.handle}</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {new Date(article.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            <span aria-hidden="true">·</span>
            {article.readingTimeMinutes ?? Math.max(1, Math.round(article.wordCount / 200))} min read
          </span>
        </div>

        {article.imageUrl ? (
          <div className="overflow-hidden rounded-3xl bg-zinc-100 shadow-soft dark:bg-zinc-900">
            <ResponsiveImage src={article.imageUrl} alt="" priority sizes="100vw" className="aspect-video h-auto w-full object-cover" />
          </div>
        ) : null}

        <div className="grid max-w-3xl gap-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-200">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="m-0">
              {paragraph}
            </p>
          ))}
        </div>

        {article.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag.slug}
                className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        ) : null}

        <ShareButtonsRow title={article.title} />
      </article>

      <CommentsSection
        anchorId="discussion"
        contentKey={`community-article:${handle}:${slug}`}
        heading={t("comment.discussion_heading")}
        initialReviews={[]}
        formTitle={t("comment.form_title")}
        formNote={t("comment.form_note")}
        showRatingField={false}
        discussionLayout={discussionLayout}
      />
    </div>
  );
}
