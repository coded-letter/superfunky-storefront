import { Bookmark, Calendar, PencilLine, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useReadingList, useSoundUX } from "../state";
import { savedListEntityId } from "../state/savedListSync";
import { ResponsiveImage } from "../media";
import { useT } from "../locale";

export type PostCardVariant = "default" | "compact" | "editorial" | "minimal";

export type PostCardTaxonomyTerm = { name: string; slug: string; href?: string };

export type PostCardData = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  /** ISO date string for the original publish date. */
  date: string;
  /** ISO date string — only shown when it differs meaningfully from `date`. */
  lastEditedDate?: string;
  /** Numeric WordPress post ID — needed for edit-flow lookups (e.g. re-fetching full
   * collaborator post detail for `WriteArticleModal`'s `initialPost`). */
  databaseId?: number;
  /** Database ID of the WordPress post author — used to cross-reference with community
   * profiles when listing a member's articles on their profile page. */
  authorDatabaseId?: number;
  languageCode?: string;
  author: { name: string; avatarUrl?: string; slug?: string; href?: string };
  wordCount: number;
  readingTimeMinutes?: number;
  categories?: PostCardTaxonomyTerm[];
  tags?: PostCardTaxonomyTerm[];
  /** Overrides the default `/blog/:slug` destination — used by community/creator
   * articles, which route to `/community/:handle/articles/:slug` instead since they
   * aren't part of the staff-authored blog's `MOCK_POST_DETAILS` lookup. */
  href?: string;
  /** Polylang/WPML translation IDs: maps lowercase language code (e.g. `"pl"`) to the
   * WordPress node ID of that translated post. Used by the reading list to resolve
   * saved IDs across language switches. */
  translations?: Record<string, string>;
};

/** Every card variant links here instead of hardcoding `/blog/${post.slug}`, so a post
 * with a custom `href` (e.g. a creator article) routes correctly everywhere this card
 * is rendered — grids, sliders, and the shortcode library alike. */
function postHref(post: PostCardData): string {
  return post.href ?? `/blog/${post.slug}`;
}

export type PostCardProps = {
  post: PostCardData;
  variant?: PostCardVariant;
  /** Optional `<img loading>` hint — pass `"eager"` for cards in/near a slider's active
   * viewport, `"lazy"` for offscreen grid cards. */
  imageLoading?: "eager" | "lazy";
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed);
}

function readingTimeLabel(post: PostCardData): string {
  const minutes = post.readingTimeMinutes ?? Math.max(1, Math.round(post.wordCount / 200));
  return `${minutes} min read`;
}

function TaxonomyPills({ post }: { post: PostCardData }) {
  const terms = [...(post.categories ?? []), ...(post.tags ?? [])];
  if (!terms.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {(post.categories ?? []).map((category) => (
        <Link
          key={`cat-${category.slug}`}
          to={category.href ?? `/blog/category/${category.slug}`}
          className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-[0.68rem] font-semibold text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
        >
          {category.name}
        </Link>
      ))}
      {(post.tags ?? []).map((tag) => (
        <Link
          key={`tag-${tag.slug}`}
          to={tag.href ?? `/blog/tag/${tag.slug}`}
          className="inline-block rounded-full bg-zinc-100 px-2.5 py-1 text-[0.68rem] font-medium text-zinc-600 no-underline transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          #{tag.name}
        </Link>
      ))}
    </div>
  );
}

/** Renders the author's name, linked to their `/blog/author/:slug` archive when a slug
 * is known — falls back to plain text for cards that only carry a bare name. Never
 * nested inside another `<Link>` in any variant, so no `stopPropagation` juggling
 * needed. */
function AuthorName({ author }: { author: PostCardData["author"] }) {
  const href = author.href ?? (author.slug ? `/blog/author/${author.slug}` : null);
  if (!href) return <>{author.name}</>;
  return (
    <Link
      to={href}
      className="text-inherit no-underline transition hover:text-brand-600 hover:underline dark:hover:text-brand-400"
    >
      {author.name}
    </Link>
  );
}

function PostBookmarkButton({ postId }: { postId: string }) {
  const t = useT();
  const { has, toggle } = useReadingList();
  const { playAction } = useSoundUX();
  const isSaved = has(postId);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(postId);
        playAction(isSaved ? "click" : "success");
      }}
      aria-pressed={isSaved}
      aria-label={isSaved ? t("product.remove_reading") : t("product.save_reading")}
      title={isSaved ? t("product.remove_reading") : t("product.save_reading")}
      className={`inline-grid h-8 w-8 shrink-0 place-items-center rounded-control shadow-soft backdrop-blur transition-all duration-300 hover:scale-110 ${
        isSaved
          ? "bg-brand-gradient text-white"
          : "bg-white/90 text-zinc-600 hover:text-brand-600 dark:bg-zinc-950/80 dark:text-zinc-300"
      }`}
    >
      <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/** Post-listing card — mirrors `ProductCard`'s variant pattern so post grids/sliders and
 * product grids/sliders feel like the same design system. Author, word count, publish/
 * last-edited dates, and category/tag pills are the WordPress-native metadata this is
 * expected to map to once the blog is wired to the CMS. */
export function PostCard({ post, variant = "default", imageLoading }: PostCardProps) {
  const { playAction } = useSoundUX();
  const wasEdited = post.lastEditedDate && post.lastEditedDate !== post.date;

  if (variant === "minimal") {
    return (
      <div className="sf-post-card funky-post-card funky-post-card--minimal group grid gap-2 rounded-2xl p-1">
        <TaxonomyPills post={post} />
        <Link
          to={postHref(post)}
          onClick={() => playAction("navigation")}
          className="font-display text-base font-semibold text-zinc-900 no-underline transition hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
        >
          {post.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" aria-hidden="true" />
            <AuthorName author={post.author} />
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatDate(post.date)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{readingTimeLabel(post)}</span>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <article className="sf-post-card funky-post-card funky-post-card--compact group grid grid-cols-[6.5rem_1fr] gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[7.5rem_1fr]">
        <Link
          to={postHref(post)}
          onClick={() => playAction("navigation")}
          className="relative block aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900"
        >
          {post.imageUrl ? (
            <ResponsiveImage
              src={post.imageUrl}
              alt={post.title}
              priority={imageLoading === "eager"}
              loading={imageLoading}
              draggable={false}
              sizes="(min-width: 640px) 7.5rem, 6.5rem"
              className="absolute inset-0 block !h-full !w-full max-w-none object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
        </Link>
        <div className="grid min-w-0 content-start gap-1">
          <Link
            to={postHref(post)}
            onClick={() => playAction("navigation")}
            className="line-clamp-2 font-display text-sm font-semibold leading-snug text-zinc-900 no-underline transition hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
          >
            {post.title}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] text-zinc-400 dark:text-zinc-500">
            <span>{formatDate(post.date)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{readingTimeLabel(post)}</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "editorial") {
    return (
      <article className="sf-post-card funky-post-card funky-post-card--editorial group relative grid overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-soft-lg">
        <div className="relative aspect-[16/9] w-full min-h-[18rem] overflow-hidden sm:aspect-[21/9] sm:min-h-[16rem]">
          {post.imageUrl ? (
            <ResponsiveImage
              src={post.imageUrl}
              alt={post.title}
              priority={imageLoading === "eager"}
              loading={imageLoading}
              draggable={false}
              sizes="(min-width: 640px) 80vw, 100vw"
              className="absolute inset-0 block !h-full !w-full max-w-none object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        </div>
        <div className="absolute inset-x-0 bottom-0 grid gap-2 p-6 sm:p-8">
          <TaxonomyPills post={post} />
          <Link
            to={postHref(post)}
            onClick={() => playAction("navigation")}
            className="m-0 line-clamp-2 font-display text-xl font-bold leading-tight text-white no-underline transition group-hover:text-brand-200 sm:text-2xl"
          >
            {post.title}
          </Link>
          <p className="m-0 hidden max-w-xl line-clamp-2 text-sm text-white/70 sm:block">{post.excerpt}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              <AuthorName author={post.author} />
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formatDate(post.date)}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>{readingTimeLabel(post)}</span>
          </div>
        </div>
        <div className="absolute right-5 top-5">
          <PostBookmarkButton postId={savedListEntityId(post)} />
        </div>
      </article>
    );
  }

  return (
    <article className="sf-post-card funky-post-card funky-post-card--default group relative grid h-full gap-3 rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        to={postHref(post)}
        onClick={() => playAction("navigation")}
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900"
      >
        {post.imageUrl ? (
          <ResponsiveImage
            src={post.imageUrl}
            alt={post.title}
            priority={imageLoading === "eager"}
            loading={imageLoading}
            draggable={false}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="absolute inset-0 block !h-full !w-full max-w-none object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </Link>

      <div className="absolute right-6 top-6">
        <PostBookmarkButton postId={savedListEntityId(post)} />
      </div>

      <div className="grid gap-2">
        <TaxonomyPills post={post} />

        <Link
          to={postHref(post)}
          onClick={() => playAction("navigation")}
          className="m-0 font-display text-base font-semibold leading-snug text-zinc-900 no-underline transition hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
        >
          {post.title}
        </Link>

        <p className="m-0 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{post.excerpt}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" aria-hidden="true" />
            <AuthorName author={post.author} />
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {formatDate(post.date)}
          </span>
          {wasEdited ? (
            <span className="inline-flex items-center gap-1" title={`Last edited ${formatDate(post.lastEditedDate as string)}`}>
              <PencilLine className="h-3 w-3" aria-hidden="true" />
              Edited {formatDate(post.lastEditedDate as string)}
            </span>
          ) : null}
          <span>{post.wordCount.toLocaleString()} words</span>
          <span>{readingTimeLabel(post)}</span>
        </div>
      </div>
    </article>
  );
}
