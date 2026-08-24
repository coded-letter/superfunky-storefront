import { Heart, MessageCircle } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { avatarColorFor } from "./socialColor";
import type { SocialFeedLayout } from "./SocialFeedGrid";
import { ResponsiveImage } from "../media";
import { CommunityMediaGallery, type SocialPostMedia } from "./CommunityMediaGallery";

export type SocialPostCardAuthor = { handle: string; displayName: string; avatarUrl?: string };

export type SocialPostCardData = {
  id: string;
  href?: string;
  image: string;
  imageSrcSet?: string;
  title?: string;
  description?: string;
  media?: SocialPostMedia[];
  /** CSS aspect-ratio value (e.g. `"4/5"`) — only used verbatim in `"masonry"` layout,
   * where the image renders at its intrinsic size instead of being cropped. */
  aspect: string;
  caption: string;
  tags: string[];
  likes: number;
  /** Whether the signed-in viewer has already liked this post — drives the heart's
   * filled state. Omit (or leave `undefined`) for contexts with no viewer concept. */
  likedByViewer?: boolean;
  comments: number;
  createdAt: string;
  author: SocialPostCardAuthor;
};

export type SocialPostCardProps = {
  post: SocialPostCardData;
  layout: SocialFeedLayout;
  /** Optional `<img loading>` hint — pass `"eager"` for above-the-fold cards. */
  imageLoading?: "eager" | "lazy";
  /** When provided, the heart/likes count becomes an interactive toggle button
   * (mirrors the single-post detail page's like button); the returned promise's
   * result becomes the card's new authoritative liked/likes state. Omit to keep
   * the heart a static, read-only count (the default for contexts with no
   * signed-in-viewer concept, e.g. the shortcode library demo). */
  onToggleLike?: (post: SocialPostCardData) => Promise<{ liked: boolean; likesCount: number }>;
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
      className="inline-flex min-h-6 min-w-0 items-center gap-2 no-underline"
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
          className="inline-flex min-h-6 items-center rounded-full bg-brand-50 px-2 py-0.5 text-[0.62rem] font-semibold text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
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
 * `"masonry"` shows the image uncropped at its own aspect ratio, `"list"` uses a
 * compact horizontal card, and the grid variants crop media to fill their cards.
 */
export function SocialPostCard({ post, layout, imageLoading = "lazy", onToggleLike }: SocialPostCardProps) {
  const navigate = useNavigate();
  const title = post.title?.trim() || post.caption;
  const description = post.description ?? post.caption;
  const [liked, setLiked] = useState(post.likedByViewer ?? false);
  const [likes, setLikes] = useState(post.likes);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  useEffect(() => {
    setLiked(post.likedByViewer ?? false);
    setLikes(post.likes);
  }, [post.likedByViewer, post.likes]);
  const media: SocialPostMedia[] = post.media?.length
    ? post.media
    : post.image
      ? [{
          databaseId: 0,
          url: post.image,
          mimeType: "image/jpeg",
          mediaType: "image",
          altText: title,
          srcSet: post.imageSrcSet,
        }]
      : [];
  const feedMedia: SocialPostMedia[] = post.image
    ? media.map((item) => item.mediaType === "video" ? { ...item, posterUrl: post.image } : item)
    : media;
  // Both the card and its nested author/tag links are clickable, so nested links
  // stop propagation (see AuthorChip/TagPills above) and this handler opens the post's
  // own discussion page for any other click on the card body.
  const openPost = () => navigate(post.href || `/community/post/${post.id}`);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a, button, input, textarea, select")) return;
    openPost();
  };
  const clickableProps = {
    onClick: handleClick,
  };
  const postHref = post.href || `/community/post/${post.id}`;
  // Mirrors CommunityPostMockupPage's own like button: optimistic-free, applies
  // only the server's confirmed liked/likesCount result, and silently keeps the
  // last-confirmed state on failure (e.g. a signed-out viewer) since a card in a
  // dense feed grid has no room for an inline error message.
  const handleLikeClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onToggleLike || isTogglingLike) return;
    setIsTogglingLike(true);
    try {
      const result = await onToggleLike(post);
      setLiked(result.liked);
      setLikes(result.likesCount);
    } catch {
      // Keep the last-confirmed liked/likes state.
    } finally {
      setIsTogglingLike(false);
    }
  };
  const likeButtonProps = onToggleLike
    ? {
        type: "button" as const,
        onClick: handleLikeClick,
        disabled: isTogglingLike,
        "aria-pressed": liked,
      }
    : { type: "button" as const, disabled: true };

  if (layout === "list") {
    return (
      <article
        {...clickableProps}
        className="sf-social-post funky-social-post-card funky-social-post-card--list grid cursor-pointer gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-soft transition hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[10rem_minmax(0,1fr)]"
      >
        <div className="relative min-h-44 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-950 sm:min-h-40">
          <CommunityMediaGallery
            media={feedMedia}
            title={title}
            imageLoading={imageLoading}
            aspect="16/10"
            fit="contain-right"
            lockAspect
            className="h-full [&>div:first-child]:h-full"
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
          <h3 className="m-0 line-clamp-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Link to={postHref} onClick={(event) => event.stopPropagation()}>{title}</Link>
          </h3>
          {description ? <p className="m-0 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{description}</p> : null}
          <TagPills tags={post.tags} />
          <div className="mt-auto flex items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <button
              {...likeButtonProps}
              className={`inline-flex items-center gap-1 ${liked ? "text-red-500" : ""} ${onToggleLike ? "" : "cursor-default"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} aria-hidden="true" />
              {likes.toLocaleString()}
            </button>
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
      <article {...clickableProps} className="sf-social-post funky-social-post-card funky-social-post-card--compact group relative aspect-square cursor-pointer overflow-hidden rounded-lg">
        <Link
          to={postHref}
          onClick={(event) => event.stopPropagation()}
          className="pointer-events-none absolute inset-0 z-30 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label={`Open ${title}`}
        >
          <span className="sr-only">Open {title}</span>
        </Link>
        <CommunityMediaGallery
          media={feedMedia}
          title={title}
          imageLoading={imageLoading}
          aspect="1/1"
          fit="cover"
          lockAspect
          className="h-full bg-zinc-100 dark:bg-zinc-950 [&>div:first-child]:h-full"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100">
          <button
            {...likeButtonProps}
            className={`inline-flex items-center gap-1 text-xs font-bold text-white ${onToggleLike ? "pointer-events-auto z-30" : ""}`}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-500 text-red-500" : "fill-white"}`} aria-hidden="true" />
            {likes.toLocaleString()}
          </button>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
            <MessageCircle className="h-3.5 w-3.5 fill-white" aria-hidden="true" />
            {post.comments}
          </span>
        </div>
      </article>
    );
  }

  // "masonry" | "grid-3" | "grid-4"
  return (
    <article
      {...clickableProps}
      className={`sf-social-post group relative cursor-pointer overflow-hidden rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg funky-social-post-card funky-social-post-card--${layout} ${
        layout === "masonry" ? "" : "aspect-[4/5] h-full w-full"
      }`}
    >
      <CommunityMediaGallery
        media={feedMedia}
        title={title}
        imageLoading={imageLoading}
        aspect={layout === "masonry" ? post.aspect : "4/5"}
        fit="cover"
        lockAspect={layout !== "masonry"}
        className={layout === "masonry" ? "relative" : "absolute inset-0 h-full bg-zinc-100 dark:bg-zinc-950 [&>div:first-child]:h-full"}
      />
      <div
        className={`pointer-events-none bg-gradient-to-t from-black/85 via-black/25 to-black/0 ${
          layout === "masonry" ? "absolute inset-0" : "absolute inset-0"
        }`}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 grid gap-1.5 p-3">
        <AuthorChip author={post.author} />
        <h3 className="m-0 line-clamp-1 text-sm font-bold text-white">
          <Link
            to={postHref}
            onClick={(event) => event.stopPropagation()}
            className="text-white no-underline"
          >
            {title}
          </Link>
        </h3>
        {description ? <p className="m-0 line-clamp-2 text-xs text-white/90">{description}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <TagPills tags={post.tags} max={2} />
          <div className="flex shrink-0 items-center gap-2.5 text-[0.68rem] font-bold text-white">
            <button
              {...likeButtonProps}
              className={`inline-flex items-center gap-1 ${onToggleLike ? "" : "cursor-default"}`}
            >
              <Heart className={`h-3 w-3 ${liked ? "fill-red-500 text-red-500" : "fill-white"}`} aria-hidden="true" />
              {likes.toLocaleString()}
            </button>
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
