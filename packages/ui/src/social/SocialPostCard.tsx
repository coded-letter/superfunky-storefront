import { Heart, MessageCircle } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { avatarColorFor } from "./socialColor";
import type { SocialFeedLayout } from "./SocialFeedGrid";
import { ResponsiveImage } from "../media";

export type SocialPostCardAuthor = { handle: string; displayName: string; avatarUrl?: string };

export type SocialPostCardData = {
  id: string;
  href?: string;
  image: string;
  /** CSS aspect-ratio value (e.g. `"4/5"`) — only used verbatim in `"masonry"` layout,
   * where the image renders at its intrinsic size instead of being cropped. */
  aspect: string;
  caption: string;
  tags: string[];
  likes: number;
  comments: number;
  createdAt: string;
  author: SocialPostCardAuthor;
};

export type SocialPostCardProps = {
  post: SocialPostCardData;
  layout: SocialFeedLayout;
  /** Optional `<img loading>` hint — pass `"eager"` for above-the-fold cards. */
  imageLoading?: "eager" | "lazy";
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = then - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) >= 1) return relativeTimeFormatter.format(diffDays, "day");
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  return relativeTimeFormatter.format(diffHours, "hour");
}

function AuthorChip({ author }: { author: SocialPostCardAuthor }) {
  const initials = author.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      to={`/community/${author.handle}`}
      className="inline-flex min-w-0 items-center gap-2 no-underline"
      onClick={(event) => event.stopPropagation()}
    >
      {author.avatarUrl ? (
        <ResponsiveImage src={author.avatarUrl} alt="" sizes="1.5rem" className="h-6 w-6 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold text-white"
          style={{ backgroundColor: avatarColorFor(author.displayName) }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <span className="truncate text-xs font-semibold text-white drop-shadow-sm">{author.displayName}</span>
    </Link>
  );
}

function TagPills({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, max).map((tag) => (
        <Link
          key={tag}
          to={`/community?tag=${encodeURIComponent(tag)}`}
          className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[0.62rem] font-semibold text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
          onClick={(event) => event.stopPropagation()}
        >
          #{tag}
        </Link>
      ))}
    </div>
  );
}

/**
 * A single upload in the community feed — the `[social-post]` shortcode's
 * implementation. Renders differently depending on the active `SocialFeedGrid` layout:
 * `"masonry"` shows the image uncropped at its own aspect ratio, `"list"` lays the
 * image and caption out side-by-side, `"compact"` crops to a tight square thumbnail
 * (profile-grid style), and `"grid-3"`/`"grid-4"` crop to a consistent portrait card.
 */
export function SocialPostCard({ post, layout, imageLoading = "lazy" }: SocialPostCardProps) {
  const navigate = useNavigate();
  // Both the card and its nested author/tag links are clickable, so nested links
  // stop propagation (see AuthorChip/TagPills above) and this handler opens the post's
  // own discussion page for any other click on the card body.
  const openPost = () => navigate(post.href || `/community/post/${post.id}`);
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPost();
    }
  };
  const clickableProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: openPost,
    onKeyDown: handleKeyDown,
  };

  if (layout === "list") {
    return (
      <article
        {...clickableProps}
        className="funky-social-post-card funky-social-post-card--list flex cursor-pointer gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-soft transition hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="relative w-28 shrink-0 overflow-hidden rounded-xl sm:w-40">
          <ResponsiveImage
            src={post.image}
            alt=""
            priority={imageLoading === "eager"}
            loading={imageLoading}
            sizes="(min-width: 640px) 10rem, 7rem"
            draggable={false}
            className="aspect-square h-full w-full object-cover"
          />
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/community/${post.author.handle}`}
              className="inline-flex min-w-0 items-center gap-2 no-underline"
              onClick={(event) => event.stopPropagation()}
            >
              {post.author.avatarUrl ? (
                <ResponsiveImage src={post.author.avatarUrl} alt="" sizes="1.75rem" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold text-white"
                  style={{ backgroundColor: avatarColorFor(post.author.displayName) }}
                  aria-hidden="true"
                >
                  {post.author.displayName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
              <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{post.author.displayName}</span>
            </Link>
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{relativeTime(post.createdAt)}</span>
          </div>
          <p className="m-0 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{post.caption}</p>
          <TagPills tags={post.tags} />
          <div className="mt-auto flex items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              {post.likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {post.comments}
            </span>
          </div>
        </div>
      </article>
    );
  }

  if (layout === "compact") {
    return (
      <article {...clickableProps} className="funky-social-post-card funky-social-post-card--compact group relative aspect-square cursor-pointer overflow-hidden rounded-lg">
        <ResponsiveImage
          src={post.image}
          alt=""
          priority={imageLoading === "eager"}
          loading={imageLoading}
          sizes="(min-width: 640px) 25vw, 50vw"
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
            <Heart className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
            {post.likes}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
            <MessageCircle className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
            {post.comments}
          </span>
        </div>
      </article>
    );
  }

  // "masonry" | "grid-3" | "grid-4"
  const imageClassName =
    layout === "masonry"
      ? "block w-full h-auto"
      : "absolute inset-0 !h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105";

  return (
    <article
      {...clickableProps}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg funky-social-post-card funky-social-post-card--${layout} ${
        layout === "masonry" ? "" : "aspect-[4/5]"
      }`}
    >
      <ResponsiveImage
        src={post.image}
        alt=""
        priority={imageLoading === "eager"}
        loading={imageLoading}
        sizes={layout === "grid-4" ? "(min-width: 1024px) 25vw, 50vw" : "(min-width: 768px) 33vw, 100vw"}
        draggable={false}
        style={layout === "masonry" ? { aspectRatio: post.aspect.replace("/", " / ") } : undefined}
        className={imageClassName}
      />
      <div
        className={`bg-gradient-to-t from-black/85 via-black/25 to-black/0 ${
          layout === "masonry" ? "absolute inset-0" : "absolute inset-0"
        }`}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 grid gap-1.5 p-3">
        <AuthorChip author={post.author} />
        <p className="m-0 line-clamp-2 text-xs text-white/90">{post.caption}</p>
        <div className="flex items-center justify-between gap-2">
          <TagPills tags={post.tags} max={2} />
          <div className="flex shrink-0 items-center gap-2.5 text-[0.68rem] font-bold text-white">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3 fill-white" aria-hidden="true" />
              {post.likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3 fill-white" aria-hidden="true" />
              {post.comments}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
