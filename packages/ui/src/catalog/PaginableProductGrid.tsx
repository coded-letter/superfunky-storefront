import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutList, RefreshCw } from "lucide-react";
import { ProductCard, type ProductCardData, type ProductCardVariant } from "./ProductCard";
import { ViewSwitch } from "../controls/ViewSwitch";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";
import { createPaginationSequenceKey } from "../hooks/paginationState";

export type ProductGridVariant = "standard" | "compact" | "editorial";
type LoadMode = "pages" | "infinite";

const LOAD_MODE_OPTIONS = [
  { value: "pages" as const, label: "Pages", icon: LayoutList },
  { value: "infinite" as const, label: "Infinite scroll", icon: RefreshCw },
];

export type PaginableProductGridProps = {
  title?: string;
  subtitle?: string;
  products: ProductCardData[];
  pageSize?: number;
  cardVariant?: ProductCardVariant;
  allowPurchaseActions?: boolean;
  gridVariant?: ProductGridVariant;
  toolbarEnd?: ReactNode;
  showFilters?: boolean;
};

type ProductSort = "featured" | "price-asc" | "price-desc" | "rating" | "name";

export function PaginableProductGrid({
  title = "Products",
  subtitle,
  products,
  pageSize = 8,
  cardVariant = "default",
  allowPurchaseActions = true,
  gridVariant = "standard",
  toolbarEnd,
  showFilters = true,
}: PaginableProductGridProps) {
  const [loadMode, setLoadMode] = useState<LoadMode>("pages");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minimumRating, setMinimumRating] = useState(0);
  const [sortBy, setSortBy] = useState<ProductSort>("featured");
  const sectionRef = useRef<HTMLElement | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.flatMap((product) => product.category ? [product.category] : []))).sort(),
    [products],
  );
  const brands = useMemo(
    () => Array.from(new Set(products.flatMap((product) => product.brand ? [product.brand] : []))).sort(),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = products.filter((product) =>
      (!normalizedQuery || [product.name, product.subtitle, product.category, product.brand].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))) &&
      (!category || product.category === category) &&
      (!brand || product.brand === brand) &&
      (product.rating || 0) >= minimumRating,
    );
    if (sortBy === "featured") return filtered;
    return [...filtered].sort((left, right) => {
      if (sortBy === "price-asc") return (left.priceAmount ?? Number.POSITIVE_INFINITY) - (right.priceAmount ?? Number.POSITIVE_INFINITY);
      if (sortBy === "price-desc") return (right.priceAmount ?? Number.NEGATIVE_INFINITY) - (left.priceAmount ?? Number.NEGATIVE_INFINITY);
      if (sortBy === "rating") return (right.rating || 0) - (left.rating || 0);
      return left.name.localeCompare(right.name);
    });
  }, [brand, category, minimumRating, products, query, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginationSequenceKey = createPaginationSequenceKey(filteredProducts);

  // Reset both modes' progress when the underlying product list changes (e.g. a filter
  // upstream narrows the catalog) so page 1 / the first batch is shown again.
  useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(pageSize);
  }, [paginationSequenceKey, pageSize]);

  // Changes page and scrolls the grid back into view — without this, jumping to page 3+
  // on a long catalog would leave the user staring at the footer with no visual feedback.
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
    return filteredProducts.slice(start, end);
  }, [currentPage, filteredProducts, pageSize]);

  const infiniteItems = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMoreInfinite = visibleCount < filteredProducts.length;

  const sentinelRef = useInfiniteScrollTrigger(() => setVisibleCount((count) => Math.min(filteredProducts.length, count + pageSize)), {
    enabled: loadMode === "infinite" && hasMoreInfinite,
  });

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let i = 1; i <= totalPages; i += 1) numbers.push(i);
    return numbers;
  }, [totalPages]);

  const visibleItems = loadMode === "infinite" ? infiniteItems : pageItems;

  return (
    <section ref={sectionRef} className="sf-product-grid grid gap-5 scroll-mt-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="grid gap-1">
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{visibleItems.length}</span> of {filteredProducts.length}
          </p>
          <ViewSwitch label="Browse" options={LOAD_MODE_OPTIONS} value={loadMode} onChange={handleModeChange} />
          {toolbarEnd}
        </div>
      </header>

      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label={`${title} filters`}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className={filterControlClass}
          />
          {categories.length > 1 ? (
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category" className={filterControlClass}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : null}
          {brands.length > 1 ? (
            <select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="Filter by brand" className={filterControlClass}>
              <option value="">All brands</option>
              {brands.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : null}
          <select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))} aria-label="Filter by minimum rating" className={filterControlClass}>
            <option value={0}>Any rating</option>
            <option value={3}>3+ stars</option>
            <option value={4}>4+ stars</option>
            <option value={4.5}>4.5+ stars</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ProductSort)} aria-label="Sort products" className={filterControlClass}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Highest rated</option>
            <option value="name">Name</option>
          </select>
          {query || category || brand || minimumRating > 0 || sortBy !== "featured" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("");
                setBrand("");
                setMinimumRating(0);
                setSortBy("featured");
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
          {visibleItems.map((product, index) => (
            <div key={product.id} className="h-full min-w-0 animate-rise-in" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}>
              <ProductCard
                product={product}
                variant={cardVariant}
                allowPurchaseActions={allowPurchaseActions}
                imageLoading={index < 2 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No products match these filters.
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
          ) : filteredProducts.length > pageSize ? (
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

function getGridClassName(variant: ProductGridVariant): string {
  if (variant === "compact") {
    return "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4";
  }

  if (variant === "editorial") {
    return "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6";
  }

  return "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5";
}
