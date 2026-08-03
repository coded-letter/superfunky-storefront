import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSoundUX } from "@funky/ui";

export type SliderWidth = "full" | "two-thirds" | "one-third";

function chunkItems<T>(items: T[], pageSize: number) {
  if (pageSize <= 0) return [items];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

// Warm the browser image cache for a URL without rendering anything — used to preload
// upcoming slider pages so images are already decoded by the time a swipe/autoplay reveals them.
const preloadedImageUrls = new Set<string>();
function preloadImage(url?: string) {
  if (!url || preloadedImageUrls.has(url)) return;
  preloadedImageUrls.add(url);
  const image = new Image();
  image.src = url;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const onChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return prefersReducedMotion;
}

// Below this breakpoint, sliders show a single item per page regardless of the requested
// pageSize, so a swipe always reveals the next item without requiring vertical scrolling.
const MOBILE_SINGLE_ITEM_QUERY = "(max-width: 639px)";
function useIsMobileSlider() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_SINGLE_ITEM_QUERY);
    setIsMobile(query.matches);
    const onChange = () => setIsMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

function widthClassName(width: SliderWidth) {
  if (width === "two-thirds") return "lg:col-span-2";
  if (width === "one-third") return "lg:col-span-1";
  return "lg:col-span-3";
}

export type SliderItemMeta = {
  /** True once this item's page is the active page or immediately adjacent to it — use to
   * mark the underlying <img> as `loading="eager"` so it's ready before a swipe reveals it. */
  isPriority: boolean;
  /** True when the slider was given a custom `height` — switch the item's sizing from a
   * fixed aspect-ratio to `h-full` so it fills that height instead. */
  hasCustomHeight: boolean;
};

export type SliderMockProps<TItem> = {
  title: string;
  subtitle: string;
  width: SliderWidth;
  items: TItem[];
  pageSize: number;
  gridClassName: string;
  renderItem: (item: TItem, index: number, meta: SliderItemMeta) => ReactNode;
  /** Enables automatic advancing every N ms. Paused on hover/focus/drag and disabled entirely
   * when the user prefers reduced motion. */
  autoplayMs?: number;
  /** Returns the image URL(s) an item depends on, so adjacent pages can be preloaded ahead of
   * the swipe/autoplay transition that reveals them. */
  getImageUrls?: (item: TItem) => Array<string | undefined>;
  /** Gap between cards within a page — defaults to a cosier "gap-5", pass a larger value
   * (e.g. "gap-7") for tracks that need more breathing room between items. */
  gap?: string;
  /** Which navigation controls to render — matches the theme shortcode's `navigation`
   * attribute (`"dots" | "arrows" | "both" | "none"`). Defaults to "both". `"none"` is
   * for pure drag/swipe-only "scrollable" rails with no visible chrome at all. */
  navigation?: "dots" | "arrows" | "both" | "none";
  /** Breaks the slide viewport out to full browser width (edge-to-edge, ignoring the
   * theme's normal `max-w-7xl` content column) — matches the `[slider fullwidth]`
   * shortcode attribute. Only intended for standalone hero-style "cinematic" sliders
   * used as their own page section (not nested inside a card/grid, where breaking out
   * would overlap sibling content); regular product/category rails should leave this
   * unset. Off by default. */
  fullBleed?: boolean;
  /** Custom viewport height (e.g. `"70vh"`, `"640px"`) — matches the `[slider height]`
   * shortcode attribute. Overrides the fixed aspect-ratio sizing a cinematic slider's
   * `renderItem` would otherwise use (see `SliderItemMeta.hasCustomHeight`). Only
   * intended for hero/cinematic sliders, same as `fullBleed` above. */
  height?: string;
  /** Hides the title/subtitle `<header>` row entirely — for clean full-bleed hero/banner
   * sliders that shouldn't show their own "shortcode studio" label above the slides
   * (real-store cinematic banners). Arrow navigation (which lives in that same header
   * row) is hidden along with it; use `navigation="dots"` or `"none"` for those cases.
   * Defaults to `true` (shown), matching every existing slider usage. */
  showHeader?: boolean;
  /** Wrap previous/next and autoplay at the ends. Defaults to true. */
  loop?: boolean;
};

const DRAG_THRESHOLD_PX = 6;
// A drag only needs to cover a small fraction of the viewport width — or this many pixels,
// whichever is smaller — to commit to the next/previous page instead of snapping back.
const SWIPE_PAGE_RATIO = 0.12;
const SWIPE_MAX_THRESHOLD_PX = 64;

/** Reusable scrollable "shortcode" slider engine: chunk items into pages, drag/swipe with
 * loop-around navigation, autoplay, dot pagination, and priority-aware image preloading.
 * Shared across the shop, blog, and home mockup pages so every slider behaves identically. */
export function SliderMock<TItem>({
  title,
  subtitle,
  width,
  items,
  pageSize,
  gridClassName,
  renderItem,
  autoplayMs,
  getImageUrls,
  gap = "gap-5",
  navigation = "both",
  fullBleed = false,
  height,
  showHeader = true,
  loop = true,
}: SliderMockProps<TItem>) {
  const isMobileSlider = useIsMobileSlider();
  const effectivePageSize = isMobileSlider ? 1 : pageSize;
  const pages = useMemo(() => chunkItems(items, effectivePageSize), [items, effectivePageSize]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(0);
  const isScrollingProgrammatically = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { playAction } = useSoundUX();

  // Drag-to-swipe state (unifies mouse-drag and touch-swipe via pointer events).
  const dragState = useRef({ isDown: false, moved: false, startX: 0, startScrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const suppressNextClick = useRef(false);

  // Autoplay pause state — paused on hover, keyboard focus, active drag, or a hidden tab.
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Re-clamp the active page and snap instantly to it whenever the page count changes
  // (e.g. crossing the mobile breakpoint re-chunks items into single-item pages).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, activePage));
    isScrollingProgrammatically.current = true;
    viewport.scrollLeft = clamped * viewport.clientWidth;
    if (clamped !== activePage) setActivePage(clamped);
    isScrollingProgrammatically.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  const goToPage = (pageIndex: number) => {
    if (!viewportRef.current || pages.length === 0) return;
    const nextIndex = loop
      ? ((pageIndex % pages.length) + pages.length) % pages.length
      : Math.max(0, Math.min(pages.length - 1, pageIndex));
    if (nextIndex !== activePage) playAction("navigation");
    isScrollingProgrammatically.current = true;
    viewportRef.current.scrollTo({ left: nextIndex * viewportRef.current.clientWidth, behavior: "smooth" });
    setActivePage(nextIndex);
    window.setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 500);
  };

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isScrollingProgrammatically.current) return;
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (!clientWidth) return;
    setActivePage(Math.max(0, Math.min(pages.length - 1, Math.round(scrollLeft / clientWidth))));
  };

  // Preload the active page plus its immediate neighbours so images are already warmed in the
  // cache before a swipe or autoplay transition scrolls them into view.
  useEffect(() => {
    if (!getImageUrls) return;
    for (const pageIndex of [activePage - 1, activePage, activePage + 1]) {
      const page = pages[pageIndex];
      if (!page) continue;
      for (const item of page) {
        for (const url of getImageUrls(item)) preloadImage(url);
      }
    }
  }, [activePage, pages, getImageUrls]);

  // Autoplay — advances on an interval, looping back to the first page, and pauses whenever the
  // user is interacting (hover/focus/drag) or the tab isn't visible.
  useEffect(() => {
    if (!autoplayMs || pages.length <= 1 || prefersReducedMotion) return;
    if (isHovered || isFocused || isDragging) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const id = window.setInterval(() => {
      if (!loop && activePage === pages.length - 1) return;
      goToPage(activePage + 1);
    }, autoplayMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayMs, pages.length, prefersReducedMotion, isHovered, isFocused, isDragging, activePage]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Don't hijack pointer capture when the gesture starts on a small persistent action
    // control (add-to-cart, wishlist, quick view, swatches, form fields, etc.) — a normal
    // click's tiny incidental pointer movement could otherwise get misread as a drag and
    // swallow the click. Links are intentionally NOT included here: several slide/card
    // designs are entirely wrapped in an <a> (e.g. the category slider's tiles, and product
    // cards once their image becomes a link to the PDP), so bailing out on `a` would make
    // those sliders undraggable everywhere except a few unlinked pixels. Dragging still
    // suppresses the resulting click via `suppressNextClick`/`onClickCapture` below, so a
    // real drag that happens to start on a link never triggers navigation — only a
    // genuine tap/click (no meaningful movement) does.
    if ((event.target as HTMLElement).closest("button, input, select, textarea, [role='button']")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragState.current = { isDown: true, moved: false, startX: event.clientX, startScrollLeft: viewport.scrollLeft };
    setIsDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    const viewport = viewportRef.current;
    if (!state.isDown || !viewport) return;
    const delta = event.clientX - state.startX;
    if (!state.moved && Math.abs(delta) > DRAG_THRESHOLD_PX) {
      state.moved = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (state.moved) {
      isScrollingProgrammatically.current = true;
      viewport.scrollLeft = state.startScrollLeft - delta;
    }
  };

  const endDrag = () => {
    const state = dragState.current;
    const viewport = viewportRef.current;
    if (state.isDown && state.moved && viewport && viewport.clientWidth) {
      suppressNextClick.current = true;
      // A minimal gesture is enough to advance a page: compare how far the drag moved away
      // from the page it started on against a small fraction of the viewport width, rather
      // than requiring the drag to cross halfway (nearest-page rounding) before committing.
      const startPage = Math.round(state.startScrollLeft / viewport.clientWidth);
      const draggedBy = viewport.scrollLeft - state.startScrollLeft;
      const swipeThreshold = Math.min(viewport.clientWidth * SWIPE_PAGE_RATIO, SWIPE_MAX_THRESHOLD_PX);
      const targetPage = Math.abs(draggedBy) > swipeThreshold ? startPage + (draggedBy > 0 ? 1 : -1) : startPage;
      isScrollingProgrammatically.current = false;
      goToPage(targetPage);
    } else {
      isScrollingProgrammatically.current = false;
    }
    dragState.current = { isDown: false, moved: false, startX: 0, startScrollLeft: 0 };
    setIsDragging(false);
  };

  const onPointerUp = () => endDrag();
  const onPointerCancel = () => endDrag();
  const onPointerLeave = () => {
    if (dragState.current.isDown) endDrag();
  };
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressNextClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick.current = false;
    }
  };

  return (
    <article
      className={`funky-slider grid min-w-0 max-w-full gap-5 overflow-hidden ${widthClassName(width)}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
    >
      {showHeader ? (
        <header className="flex min-h-[3.75rem] flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-1 pr-2">
            <h3 className="m-0 truncate font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="m-0 truncate text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          </div>
          {pages.length > 1 && (navigation === "arrows" || navigation === "both") ? (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                aria-label={`Previous ${title}`}
                disabled={!loop && activePage === 0}
                onClick={() => goToPage(activePage - 1)}
                className="inline-grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-brand-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[2.5rem] text-center text-xs font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
                {activePage + 1}/{pages.length}
              </span>
              <button
                type="button"
                aria-label={`Next ${title}`}
                disabled={!loop && activePage === pages.length - 1}
                onClick={() => goToPage(activePage + 1)}
                className="inline-grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-brand-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </header>
      ) : null}

      <div className={fullBleed ? "relative left-1/2 right-1/2 -mx-[50vw] w-screen" : "min-w-0 max-w-full overflow-hidden"}>
        <div
          ref={viewportRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
          onClickCapture={onClickCapture}
          className={`-mx-1 flex overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isDragging ? "cursor-grabbing select-none" : "snap-x snap-mandatory cursor-grab scroll-smooth"
          }`}
          style={{
            touchAction: "pan-y",
            scrollSnapType: isDragging ? "none" : undefined,
            ...(height ? { height } : {}),
          }}
        >
          {pages.map((page, pageIndex) => (
            <div key={pageIndex} className={`min-w-0 w-full shrink-0 snap-start snap-always ${height ? "h-full" : ""}`}>
              <div className={`grid min-w-0 ${gap} ${gridClassName} ${height ? "h-full" : ""}`}>
                {page.map((item, itemIndex) =>
                  renderItem(item, pageIndex * effectivePageSize + itemIndex, {
                    isPriority: Math.abs(pageIndex - activePage) <= 1,
                    hasCustomHeight: Boolean(height),
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (navigation === "dots" || navigation === "both") ? (
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label={`${title} pagination`}>
          {pages.map((_, pageIndex) => (
            <button
              key={pageIndex}
              type="button"
              role="tab"
              aria-selected={activePage === pageIndex}
              aria-label={`Go to slide ${pageIndex + 1} of ${pages.length}`}
              onClick={() => goToPage(pageIndex)}
              className="group/dot grid h-6 w-6 place-items-center focus-visible:outline-none"
            >
              <span
                className={`block rounded-full transition-all duration-300 ease-out ${
                  activePage === pageIndex
                    ? "h-2 w-7 bg-brand-600 dark:bg-brand-400"
                    : "h-2 w-2 bg-zinc-300 group-hover/dot:bg-zinc-400 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-brand-400 dark:bg-zinc-700 dark:group-hover/dot:bg-zinc-600"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
