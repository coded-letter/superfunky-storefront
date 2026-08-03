import type { CSSProperties } from "react";

/** Performance-oriented image wrapper — the frontend half of the "100 Lighthouse
 * score" goal. Three concrete techniques, all with zero backend dependency:
 *
 * 1. Responsive `srcset`/`sizes` — for Unsplash-hosted mockup photos (the vast
 *    majority of this project's imagery) it generates a handful of width variants via
 *    Unsplash's own `?w=` resize param so the browser downloads the smallest image
 *    that actually fills the slot, instead of one oversized master image everywhere.
 *    Any other URL (future WP media library uploads) is passed through untouched —
 *    once the backend serves its own responsive srcset (WordPress does this natively
 *    for `wp_get_attachment_image`), this component's manual srcset generation should
 *    be skipped in favor of the server-provided one.
 * 2. Explicit `width`/`height` (or an `aspectRatio` class) reserve the image's box
 *    before it loads — the #1 fix for Cumulative Layout Shift.
 * 3. `loading`/`fetchPriority`/`decoding` hints — lazy + async by default, with a
 *    `priority` escape hatch for above-the-fold hero/LCP images (eager + high
 *    fetchPriority + no async decoding, so it's not competing with itself).
 */

const UNSPLASH_HOST_PATTERN = /images\.unsplash\.com/;
const UNSPLASH_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600];

function withUnsplashWidth(url: string, width: number): string {
  const optimized = new URL(url);
  // `q=75` matches the compression level most performance audits consider the sweet
  // spot for photographic content; `auto=format` lets Unsplash serve AVIF/WebP to
  // browsers that support it without the frontend needing its own format negotiation.
  optimized.searchParams.set("w", String(width));
  optimized.searchParams.set("q", "75");
  optimized.searchParams.set("auto", "format");
  optimized.searchParams.set("fit", "crop");
  return optimized.toString();
}

function buildSrcSet(url: string): string | undefined {
  if (!UNSPLASH_HOST_PATTERN.test(url)) return undefined;
  return UNSPLASH_WIDTHS.map((width) => `${withUnsplashWidth(url, width)} ${width}w`).join(", ");
}

export type ResponsiveImageProps = {
  src: string;
  alt: string;
  /** Intrinsic width in px — required alongside `height` to reserve layout space and
   * avoid CLS. Omit both (and rely on a wrapper with a fixed aspect ratio class,
   * e.g. Tailwind's `aspect-[4/5]`) for fluid card grids where a fixed px size
   * doesn't apply. */
  width?: number;
  height?: number;
  /** Sizes hint for the srcset — defaults to a common responsive-card guess.
   * Override for known layouts (e.g. a full-bleed hero should pass `"100vw"`). */
  sizes?: string;
  /** Marks an above-the-fold / LCP-candidate image: eager-loads, hints high fetch
   * priority, and skips async decoding so it paints as soon as possible instead of
   * being deprioritized behind lazy-loaded content. */
  priority?: boolean;
  /** Explicit loading behavior for slider/media cases. `priority` always wins. */
  loading?: "eager" | "lazy";
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
};

export function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
  loading = "lazy",
  className,
  style,
  draggable = true,
  "aria-hidden": ariaHidden,
}: ResponsiveImageProps) {
  const srcSet = buildSrcSet(src);

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : loading}
      decoding={priority ? "sync" : "async"}
      // fetchPriority isn't in older React's JSX typings — set via a data-safe cast.
      {...({ fetchpriority: priority ? "high" : "auto" } as Record<string, string>)}
      draggable={draggable}
      aria-hidden={ariaHidden}
      style={style}
      className={className}
    />
  );
}
