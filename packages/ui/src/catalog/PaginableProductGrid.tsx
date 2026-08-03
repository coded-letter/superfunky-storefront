import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutList, RefreshCw } from "lucide-react";
import { ProductCard, type ProductCardData, type ProductCardVariant } from "./ProductCard";
import { ViewSwitch } from "../controls/ViewSwitch";
import { useInfiniteScrollTrigger } from "../hooks/useInfiniteScrollTrigger";

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
};

export function PaginableProductGrid({
  title = "Products",
  subtitle,
  products,
  pageSize = 8,
  cardVariant = "default",
  allowPurchaseActions = true,
  gridVariant = "standard",
  toolbarEnd,
}: PaginableProductGridProps) {
  const [loadMode, setLoadMode] = useState<LoadMode>("pages");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const sectionRef = useRef<HTMLElement | null>(null);

  // Reset both modes' progress when the underlying product list changes (e.g. a filter
  // upstream narrows the catalog) so page 1 / the first batch is shown again.
  useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(pageSize);
  }, [products, pageSize]);

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
    return products.slice(start, end);
  }, [currentPage, pageSize, products]);

  const infiniteItems = useMemo(() => products.slice(0, visibleCount), [products, visibleCount]);
  const hasMoreInfinite = visibleCount < products.length;

  const sentinelRef = useInfiniteScrollTrigger(() => setVisibleCount((count) => Math.min(products.length, count + pageSize)), {
    enabled: loadMode === "infinite" && hasMoreInfinite,
  });

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    for (let i = 1; i <= totalPages; i += 1) numbers.push(i);
    return numbers;
  }, [totalPages]);

  const visibleItems = loadMode === "infinite" ? infiniteItems : pageItems;

  return (
    <section ref={sectionRef} className="grid gap-5 scroll-mt-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="grid gap-1">
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{visibleItems.length}</span> of {products.length}
          </p>
          <ViewSwitch label="Browse" options={LOAD_MODE_OPTIONS} value={loadMode} onChange={handleModeChange} />
          <label className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:inline-flex">
            Sort by
            <select className="bg-transparent text-zinc-900 outline-none dark:text-zinc-100">
              <option>Featured</option>
              <option>Price: low to high</option>
              <option>Price: high to low</option>
              <option>Newest</option>
            </select>
          </label>
          {toolbarEnd}
        </div>
      </header>

      <div className={getGridClassName(gridVariant)}>
        {visibleItems.map((product, index) => (
          <div key={product.id} className="animate-rise-in" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}>
            <ProductCard product={product} variant={cardVariant} allowPurchaseActions={allowPurchaseActions} />
          </div>
        ))}
      </div>

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
          ) : products.length > pageSize ? (
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">You&apos;ve reached the end.</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const pageButtonClass =
  "inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

function getGridClassName(variant: ProductGridVariant): string {
  if (variant === "compact") {
    return "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4";
  }

  if (variant === "editorial") {
    return "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6";
  }

  return "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5";
}
