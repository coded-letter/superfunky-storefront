import { useEffect, useRef } from "react";

export type UseInfiniteScrollTriggerOptions = {
  /** Only observes while true — lets a grid stay in "Pages" mode without paying for an
   * IntersectionObserver it isn't using. */
  enabled: boolean;
  /** How far below the viewport the sentinel should trigger — a little lead distance
   * (default 400px) means the next batch is already rendered by the time the user
   * scrolls to the very bottom, avoiding a visible "loading gap". */
  rootMargin?: string;
};

/**
 * Returns a ref to attach to an invisible sentinel element placed just after the last
 * rendered item — calls `onIntersect` (e.g. "reveal the next page's worth of items")
 * once that sentinel scrolls into view. Shared by `PaginableProductGrid`,
 * `PaginablePostGrid`, and `SocialFeedGrid`'s "Infinite scroll" mode so all three grids
 * auto-append using identical observer behaviour instead of three subtly different
 * hand-rolled implementations.
 */
export function useInfiniteScrollTrigger(onIntersect: () => void, { enabled, rootMargin = "400px" }: UseInfiniteScrollTriggerOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback in a ref so the observer effect below doesn't need to
  // re-subscribe every time `onIntersect` is recreated (e.g. on every render).
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onIntersectRef.current();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
