import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutList, RefreshCw } from "lucide-react";
import { PostCard, type PostCardData, type PostCardVariant } from "./PostCard";
import { ViewSwitch } from "../controls/ViewSwitch";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { createPaginationSequenceKey } from "../hooks/paginationState";

export type PostGridVariant = "standard" | "compact" | "list";
type LoadMode = "pages" | "infinite";

const LOAD_MODE_OPTIONS = [
  { value: "pages" as const, label: "Pages", icon: LayoutList },
  { value: "infinite" as const, label: "Infinite scroll", icon: RefreshCw },
];

export type PaginablePostGridProps = {
  title?: string;
  subtitle?: string;
  posts: PostCardData[];
  pageSize?: number;
  cardVariant?: PostCardVariant;
  gridVariant?: PostGridVariant;
  toolbarEnd?: ReactNode;
  showFilters?: boolean;
};

type PostSort = "default" | "newest" | "oldest" | "title";

/** Paginated post listing — mirrors `PaginableProductGrid`'s pagination + scroll-to-top
 * behaviour, and its "Pages vs Infinite scroll" toggle, so the blog and shop grids feel
 * consistent. */
export function PaginablePostGrid({
  title = "Latest posts",
  subtitle,
  posts,
  pageSize = 6,
  cardVariant = "default",
  gridVariant = "standard",
  toolbarEnd,
  showFilters = true,
}: PaginablePostGridProps) {
  const [loadMode, setLoadMode] = useState<LoadMode>("pages");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [author, setAuthor] = useState("");
  const [sortBy, setSortBy] = useState<PostSort>("default");
  const sectionRef = useRef<HTMLElement | null>(null);

  const categories = useMemo(
    () => Array.from(new Map(posts.flatMap((post) => post.categories || []).map((term) => [term.slug, term.name])).entries()).sort((left, right) => left[1].localeCompare(right[1])),
    [posts],
  );
  const tags = useMemo(
    () => Array.from(new Map(posts.flatMap((post) => post.tags || []).map((term) => [term.slug, term.name])).entries()).sort((left, right) => left[1].localeCompare(right[1])),
    [posts],
  );
  const authors = useMemo(
    () => Array.from(new Set(posts.map((post) => post.author.name))).sort(),
    [posts],
  );
  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = posts.filter((post) =>
      (!normalizedQuery || [post.title, post.excerpt, post.author.name, ...(post.categories || []).map((term) => term.name), ...(post.tags || []).map((term) => term.name)]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))) &&
      (!category || post.categories?.some((term) => term.slug === category)) &&
      (!tag || post.tags?.some((term) => term.slug === tag)) &&
      (!author || post.author.name === author),
    );
    if (sortBy === "default") return filtered;
    return [...filtered].sort((left, right) => {
      if (sortBy === "title") return left.title.localeCompare(right.title);
      const direction = sortBy === "oldest" ? 1 : -1;
      return (Date.parse(left.date) - Date.parse(right.date)) * direction;
    });
  }, [author, category, posts, query, sortBy, tag]);
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const paginationSequenceKey = createPaginationSequenceKey(filteredPosts);

  // Reset both modes' progress when the underlying post list changes (e.g. a filter
  // upstream narrows the archive) so page 1 / the first batch is shown again.
  useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(pageSize);
  }, [paginationSequenceKey, pageSize]);

  // Changes page and scrolls the grid back into view — without this, jumping to page 3+
  // on a long archive would leave the user staring at the footer with no visual feedback.
  const changePage = (page: number) => {
    setCurrentPage(page);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleModeChange = (mode: LoadMode) => {
    setLoadMode(mode);
    setCurrentPage(1);
    setVisibleCount(pageSize);
  };

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredPosts.slice(start, end);
  }, [currentPage, filteredPosts, pageSize]);

  const infiniteItems = useMemo(() => filteredPosts.slice(0, visibleCount), [filteredPosts, visibleCount]);
  const hasMoreInfinite = visibleCount < filteredPosts.length;

  const sentinelRef = useInfiniteScrollTrigger(() => setVisibleCount((count) => Math.min(filteredPosts.length, count + pageSize)), {
    enabled: loadMode === "infinite" && hasMoreInfinite,
  });

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let i = 1; i <= totalPages; i += 1) numbers.push(i);
    return numbers;
  }, [totalPages]);

  const visibleItems = loadMode === "infinite" ? infiniteItems : pageItems;

  return (
    <section ref={sectionRef} className="sf-post-grid grid gap-5 scroll-mt-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="grid gap-1">
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{visibleItems.length}</span> of {filteredPosts.length}
          </p>
          <ViewSwitch label="Browse" options={LOAD_MODE_OPTIONS} value={loadMode} onChange={handleModeChange} />
          {toolbarEnd}
        </div>
      </header>

      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label={`${title} filters`}>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search posts" aria-label="Search posts" className={filterControlClass} />
          {categories.length > 1 ? (
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category" className={filterControlClass}>
              <option value="">All categories</option>
              {categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          ) : null}
          {tags.length > 1 ? (
            <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Filter by tag" className={filterControlClass}>
              <option value="">All tags</option>
              {tags.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          ) : null}
          {authors.length > 1 ? (
            <select value={author} onChange={(event) => setAuthor(event.target.value)} aria-label="Filter by author" className={filterControlClass}>
              <option value="">All authors</option>
              {authors.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : null}
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as PostSort)} aria-label="Sort posts" className={filterControlClass}>
            <option value="default">Default order</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
          </select>
          {query || category || tag || author || sortBy !== "default" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("");
                setTag("");
                setAuthor("");
                setSortBy("default");
              }}
              className="px-2 text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-brand-600 hover:underline dark:text-zinc-400"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {visibleItems.length ? (
        <div className={getGridClassName(gridVariant)}>
          {visibleItems.map((post, index) => (
            <div key={post.id} className="h-full min-w-0 animate-rise-in" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}>
              <PostCard post={post} variant={cardVariant} imageLoading={index < 2 ? "eager" : "lazy"} />
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No posts match these filters.
        </p>
      )}

      {loadMode === "pages" && totalPages > 1 ? (
        <nav aria-label={`${title} pagination`} className="flex flex-wrap justify-center gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => changePage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`${pageButtonClass} px-3.5`}
          >
            ← Prev
          </button>

          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => changePage(pageNumber)}
              className={[
                pageButtonClass,
                "w-9 justify-center",
                pageNumber === currentPage
                  ? "border-transparent bg-brand-gradient text-white shadow-glow"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300",
              ].join(" ")}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`${pageButtonClass} px-3.5`}
          >
            Next →
          </button>
        </nav>
      ) : null}

      {loadMode === "infinite" ? (
        <div ref={sentinelRef} className="flex h-10 items-center justify-center">
          {hasMoreInfinite ? (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading more…
            </span>
          ) : filteredPosts.length > pageSize ? (
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">You&apos;ve reached the end.</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const pageButtonClass =
  "inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

const filterControlClass =
  "min-h-9 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-soft outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-brand-500 dark:focus:ring-brand-900";

function getGridClassName(variant: PostGridVariant): string {
  if (variant === "compact") {
    return "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4";
  }

  if (variant === "list") {
    return "grid gap-4";
  }

  return "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5";
}
