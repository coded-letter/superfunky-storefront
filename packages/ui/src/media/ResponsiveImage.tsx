import type { CSSProperties } from "react";
import { normalizeManagedMediaUrl } from "./ResponsiveImage.urls";

/** Performance-oriented image wrapper — the frontend half of the "100 Lighthouse
 * score" goal. Three concrete techniques, all with zero backend dependency:
 *
 * 1. Responsive `srcset`/`sizes` — for Unsplash-hosted mockup photos (the vast
 *    majority of this project's imagery) it generates a handful of width variants via
 *    Unsplash's own `?w=` resize param so the browser downloads the smallest image
 *    that actually fills the slot, instead of one oversized master image everywhere.
 *    WordPress media on managed Netlify storefronts uses the same width candidates
 *    through Netlify Image CDN so oversized originals are not sent across origins.
 * 2. Explicit `width`/`height` (or an `aspectRatio` class) reserve the image's box
 *    before it loads — the #1 fix for Cumulative Layout Shift.
 * 3. `loading`/`fetchPriority`/`decoding` hints — lazy + async by default, with a
 *    `priority` escape hatch for above-the-fold hero/LCP images (eager + high
 *    fetchPriority + no async decoding, so it's not competing with itself).
 */

const UNSPLASH_HOST_PATTERN = /images\.unsplash\.com/;
const UNSPLASH_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600];
const RESPONSIVE_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600];

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
  const netlifySrcSet = buildNetlifySrcSet(url);
  if (netlifySrcSet) return netlifySrcSet;
  if (!UNSPLASH_HOST_PATTERN.test(url)) return undefined;
  return UNSPLASH_WIDTHS.map((width) => `${withUnsplashWidth(url, width)} ${width}w`).join(", ");
}

function netlifyImageUrl(source: string, width: number): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (!/(?:^|\.)superfunky\.pro$|\.netlify\.app$/i.test(window.location.hostname)) return undefined;
  let mediaUrl: URL;
  try {
    mediaUrl = new URL(source);
  } catch {
    return undefined;
  }
  if (mediaUrl.protocol === "http:" && /(?:^|\.)superfunky\.pro$/i.test(mediaUrl.hostname)) {
    mediaUrl.protocol = "https:";
  }
  if (
    !/^(?:v[0-9]+|dev|blog|shop|sample)\.superfunky\.pro$/i.test(mediaUrl.hostname)
    || !mediaUrl.pathname.startsWith("/wp-content/uploads/")
    || !/\.(?:avif|jpe?g|png|webp)$/i.test(mediaUrl.pathname)
  ) return undefined;
  const parameters = new URLSearchParams({
    url: mediaUrl.toString(),
    w: String(Math.max(1, Math.min(1920, Math.round(width)))),
    q: "75",
  });
  return `/.netlify/images?${parameters.toString()}`;
}

function buildNetlifySrcSet(url: string): string | undefined {
  const candidates = RESPONSIVE_WIDTHS.flatMap((width) => {
    const candidate = netlifyImageUrl(url, width);
    return candidate ? [`${candidate} ${width}w`] : [];
  });
  return candidates.length ? candidates.join(", ") : undefined;
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
  /** Backend-provided responsive candidates. Used unless the managed edge CDN can
   * generate same-origin candidates for an eligible WordPress media URL. */
  srcSet?: string;
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
  srcSet: providedSrcSet,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
  loading = "lazy",
  className,
  style,
  draggable = true,
  "aria-hidden": ariaHidden,
}: ResponsiveImageProps) {
  const resolvedSource = normalizeManagedMediaUrl(src);
  const generatedSrcSet = buildSrcSet(resolvedSource);
  const srcSet = generatedSrcSet || providedSrcSet;
  const resolvedSrc = netlifyImageUrl(resolvedSource, width ?? (priority ? 1280 : 1024)) || resolvedSource;
  const usesNetlifyOptimization = resolvedSrc !== resolvedSource;

  return (
    <img
      src={resolvedSrc}
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
      onError={usesNetlifyOptimization ? (event) => {
        const image = event.currentTarget;
        if (image.getAttribute("src") === resolvedSource) return;
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        image.src = resolvedSource;
      } : undefined}
      style={style}
      className={["sf-responsive-image", className].filter(Boolean).join(" ")}
    />
  );
}
