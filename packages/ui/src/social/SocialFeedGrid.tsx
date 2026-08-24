import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutGrid, List, Rows3, Grid2x2, Grid3x3, LayoutList, RefreshCw } from "lucide-react";
import { SocialPostCard, type SocialPostCardData } from "./SocialPostCard";
import { ViewSwitch } from "../controls/ViewSwitch";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { useTagInterests } from "../state";

export type SocialFeedLayout = "masonry" | "grid-3" | "grid-4" | "list" | "compact";
export type SocialFeedLoadMode = "manual" | "infinite";
type SocialFeedSort = "newest" | "oldest" | "popular";

const LOAD_MODE_OPTIONS = [
  { value: "manual" as const, label: "Load more", icon: LayoutList },
  { value: "infinite" as const, label: "Infinite scroll", icon: RefreshCw },
];

const LAYOUT_OPTIONS: { value: SocialFeedLayout; label: string }[] = [
  { value: "masonry", label: "Masonry" },
  { value: "grid-3", label: "3 columns" },
  { value: "grid-4", label: "4 columns" },
  { value: "list", label: "List" },
  { value: "compact", label: "Compact grid (profile-style)" },
];

const LAYOUT_ICON: Record<SocialFeedLayout, typeof LayoutGrid> = {
  masonry: LayoutGrid,
  "grid-3": Grid2x2,
  "grid-4": Grid3x3,
  list: Rows3,
  compact: List,
};

export type SocialFeedGridProps = {
  title?: string;
  subtitle?: string;
  posts: SocialPostCardData[];
  pageSize?: number;
  /** When given a non-empty list, renders an "interested in" tag filter row above the
   * grid — clicking a tag toggles it in/out of an OR-based selection (matches any post
   * carrying at least one selected tag), mirroring the taxonomy pill filters used
   * elsewhere in the theme. */
  availableTags?: string[];
  /** Pre-selects these tags on mount — used by `/community?tag=...` deep links (e.g.
   * clicking a `#tag` pill from a post card) so arriving with a tag in the URL lands
   * already filtered. */
  initialSelectedTags?: string[];
  defaultLayout?: SocialFeedLayout;
  defaultLoadMode?: SocialFeedLoadMode;
  emptyMessage?: string;
  toolbarEnd?: ReactNode;
  /** Forwarded to each `SocialPostCard` — see its docs for behavior. */
  onToggleLike?: (post: SocialPostCardData) => Promise<{ liked: boolean; likesCount: number }>;
};

/**
 * Paginable, layout-switchable social feed grid — the community board's core
 * building block, reused for both the site-wide feed (`/community`) and a single
 * user's own feed (`/community/:handle`). Mirrors `PaginablePostGrid`/
 * `PaginableProductGrid`'s header conventions (title/subtitle, "showing N of M") and
 * their "Load more vs Infinite scroll" toggle, and adds the layout dropdown and
 * optional tag filter unique to this feed.
 */
export function SocialFeedGrid({
  title = "Community feed",
  subtitle,
  posts,
  pageSize = 12,
  availableTags = [],
  initialSelectedTags = [],
  defaultLayout = "masonry",
  defaultLoadMode = "manual",
  emptyMessage = "No posts yet — be the first to share something here.",
  toolbarEnd,
  onToggleLike,
}: SocialFeedGridProps) {
  const [layout, setLayout] = useState<SocialFeedLayout>(defaultLayout);
  const [loadMode, setLoadMode] = useState<SocialFeedLoadMode>(defaultLoadMode);
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [sortBy, setSortBy] = useState<SocialFeedSort>("newest");
  // "Tags I'm interested in" persists to localStorage exactly like the wishlist/reading
  // list do, so a visitor's filter selection on the community feed survives reloads.
  const { ids: interestedTags, has: hasInterest, toggle: toggleInterest } = useTagInterests();
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sectionRef = useRef<HTMLElement | null>(null);
  const appliedDeepLinkTags = useRef(false);

  // A `?tag=` deep link (e.g. from a post card's `#tag` pill) should add that tag to the
  // persisted selection once on mount, without clobbering tags the visitor already had
  // selected from a previous visit.
  useEffect(() => {
    if (appliedDeepLinkTags.current || !initialSelectedTags.length) return;
    appliedDeepLinkTags.current = true;
    initialSelectedTags.forEach((tag) => {
      if (!hasInterest(tag)) toggleInterest(tag);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTag = (tag: string) => {
    toggleInterest(tag);
    setVisibleCount(pageSize);
  };

  const clearTags = () => {
    interestedTags.forEach((tag) => toggleInterest(tag));
    setVisibleCount(pageSize);
  };

  // Only the instance that renders the tag-filter row (i.e. is given `availableTags`,
  // currently just the site-wide `/community` feed) actually filters by the persisted
  // selection — a profile's own feed shouldn't silently narrow based on someone else's
  // saved interests.
  const activeTagFilter = availableTags.length ? interestedTags.filter((tag) => availableTags.includes(tag)) : [];
  const authors = useMemo(
    () => Array.from(new Map(posts.map((post) => [post.author.handle, post.author.displayName])).entries()).sort((left, right) => left[1].localeCompare(right[1])),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = posts.filter((post) =>
      (!activeTagFilter.length || post.tags.some((tag) => activeTagFilter.includes(tag))) &&
      (!author || post.author.handle === author) &&
      (!normalizedQuery || [post.title || "", post.description || "", post.caption, post.author.displayName, post.author.handle, ...post.tags]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))),
    );
    return [...filtered].sort((left, right) => {
      if (sortBy === "popular") return right.likes - left.likes;
      const direction = sortBy === "oldest" ? 1 : -1;
      return (Date.parse(left.createdAt) - Date.parse(right.createdAt)) * direction;
    });
  }, [activeTagFilter, author, posts, query, sortBy]);

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  const sentinelRef = useInfiniteScrollTrigger(() => setVisibleCount((count) => Math.min(filteredPosts.length, count + pageSize)), {
    enabled: loadMode === "infinite" && hasMore,
  });

  const handleLayoutChange = (next: SocialFeedLayout) => {
    setLayout(next);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  return (
    <section ref={sectionRef} className="sf-social-feed grid gap-5 scroll-mt-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="grid gap-1">
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{visiblePosts.length}</span> of {filteredPosts.length}
          </p>
          <ViewSwitch label="Browse" options={LOAD_MODE_OPTIONS} value={loadMode} onChange={setLoadMode} />
          <label className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:inline-flex">
            {(() => {
              const Icon = LAYOUT_ICON[layout];
              return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
            })()}
            Layout
            <select
              value={layout}
              onChange={(event) => handleLayoutChange(event.target.value as SocialFeedLayout)}
              className="bg-transparent text-zinc-900 outline-none dark:text-zinc-100"
            >
              {LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {toolbarEnd}
        </div>
      </header>

      {availableTags.length ? (
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label={`${title} filters`}>
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(pageSize); }} placeholder="Search feed" aria-label="Search feed" className={filterControlClass} />
          {authors.length > 1 ? (
            <select value={author} onChange={(event) => { setAuthor(event.target.value); setVisibleCount(pageSize); }} aria-label="Filter by author" className={filterControlClass}>
              <option value="">All authors</option>
              {authors.map(([handle, name]) => <option key={handle} value={handle}>{name}</option>)}
            </select>
          ) : null}
          <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as SocialFeedSort); setVisibleCount(pageSize); }} aria-label="Sort feed" className={filterControlClass}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Most liked</option>
          </select>
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Interested in</span>
          {availableTags.map((tag) => {
            const isActive = activeTagFilter.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? "border-transparent bg-brand-gradient text-white shadow-glow"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {activeTagFilter.length || query || author || sortBy !== "newest" ? (
            <button
              type="button"
              onClick={() => {
                clearTags();
                setQuery("");
                setAuthor("");
                setSortBy("newest");
              }}
              className="text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-brand-600 hover:underline dark:text-zinc-500 dark:hover:text-brand-400"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!filteredPosts.length ? (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className={getLayoutClassName(layout)}>
            {visiblePosts.map((post, index) => (
              <div
                key={post.id}
                className={layout === "masonry" ? "mb-4 break-inside-avoid" : "animate-rise-in flex h-full w-full items-stretch justify-center"}
                style={layout === "masonry" ? undefined : { animationDelay: `${index * 30}ms`, animationFillMode: "backwards" }}
              >
                <SocialPostCard post={post} layout={layout} imageLoading={index < 2 ? "eager" : "lazy"} onToggleLike={onToggleLike} />
              </div>
            ))}
          </div>

          {loadMode === "manual" && hasMore ? (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + pageSize)}
              className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
            >
              Load more
            </button>
          ) : null}

          {loadMode === "infinite" ? (
            <div ref={sentinelRef} className="flex h-10 items-center justify-center">
              {hasMore ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading more…
                </span>
              ) : filteredPosts.length > pageSize ? (
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">You&apos;ve reached the end.</span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

const filterControlClass =
  "min-h-9 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-soft outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-brand-500 dark:focus:ring-brand-900";

function getLayoutClassName(layout: SocialFeedLayout): string {
  if (layout === "masonry") {
    return "columns-2 gap-4 sm:columns-3 lg:columns-4";
  }
  if (layout === "grid-3") {
    return "grid grid-cols-2 gap-4 sm:grid-cols-3";
  }
  if (layout === "grid-4") {
    return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";
  }
  if (layout === "compact") {
    return "grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6";
  }
  // "list"
  return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
}
