/** Loading-animation settings sourced from the WordPress Control Center's "Loading
 * animation" panel (`funkycommerce_storefront_control_settings()['loader']`). The
 * backend intentionally accepts loose admin input (any media URL, out-of-range numbers,
 * malformed hex colors), so every value here is re-validated on the frontend before it
 * ever reaches a CSS custom property or a `<img>`/`<video>` `src` — invalid input quietly
 * falls back to the bundled crystal preloader instead of breaking the loading state. */

export type LoaderConfiguration = {
  enabled: boolean;
  /** Absolute URL to a custom GIF/SVG/WebP/PNG/video loading asset, or `null` when
   * unset — validated to a known-safe extension by `normalizeLoaderConfiguration`. */
  customUrl: string | null;
  /** Crystal height in pixels (16–240, matching the backend field's min/max). */
  size: number;
  /** Full animation-cycle duration in milliseconds (400–10000). */
  duration: number;
  primaryColor: string;
  glowColor: string;
  /** 0–1 opacity multiplier for the crystal's ambient glow. */
  glowOpacity: number;
};

export const DEFAULT_LOADER_CONFIGURATION: LoaderConfiguration = {
  enabled: true,
  customUrl: null,
  size: 44,
  duration: 1400,
  primaryColor: "#7c3aed",
  glowColor: "#c4b5fd",
  glowOpacity: 0.55,
};

const MIN_LOADER_SIZE = 16;
const MAX_LOADER_SIZE = 240;
const MIN_LOADER_DURATION_MS = 400;
const MAX_LOADER_DURATION_MS = 10_000;

/** Baseline duration (ms) the bundled `CrystalPreloader`'s animation timings assume a
 * `speedMultiplier` of `1` for — matches the backend's default `loader_speed`. */
export const LOADER_SPEED_BASELINE_MS = 1400;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const IMAGE_EXTENSIONS = ["gif", "svg", "webp", "png", "jpg", "jpeg", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed : fallback;
}

function fileExtension(url: string): string {
  try {
    const { pathname } = new URL(url);
    const match = /\.([a-z0-9]+)$/i.exec(pathname);
    return match ? match[1].toLowerCase() : "";
  } catch {
    return "";
  }
}

/** Media kind for a validated loader `customUrl`, or `null` when the URL is missing,
 * not `http(s)`, or doesn't end in a supported extension. */
export function getLoaderMediaKind(url: string | null | undefined): "image" | "video" | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  const extension = fileExtension(url);
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  return null;
}

/** Validates and clamps a raw loader payload (as returned by GraphQL, which may be
 * partial/missing while the backend field is rolling out, or malformed if an admin
 * saved unexpected values) into a safe, fully-populated `LoaderConfiguration`. */
export function normalizeLoaderConfiguration(
  raw: Partial<LoaderConfiguration> | null | undefined,
): LoaderConfiguration {
  if (!raw || typeof raw !== "object") return DEFAULT_LOADER_CONFIGURATION;

  const rawCustomUrl = typeof raw.customUrl === "string" ? raw.customUrl.trim() : "";
  const customUrl = rawCustomUrl && getLoaderMediaKind(rawCustomUrl) ? rawCustomUrl : null;

  const size = toFiniteNumber(raw.size);
  const duration = toFiniteNumber(raw.duration);
  const glowOpacity = toFiniteNumber(raw.glowOpacity);

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_LOADER_CONFIGURATION.enabled,
    customUrl,
    size: size !== null ? clamp(size, MIN_LOADER_SIZE, MAX_LOADER_SIZE) : DEFAULT_LOADER_CONFIGURATION.size,
    duration: duration !== null
      ? clamp(duration, MIN_LOADER_DURATION_MS, MAX_LOADER_DURATION_MS)
      : DEFAULT_LOADER_CONFIGURATION.duration,
    primaryColor: normalizeHexColor(raw.primaryColor, DEFAULT_LOADER_CONFIGURATION.primaryColor),
    glowColor: normalizeHexColor(raw.glowColor, DEFAULT_LOADER_CONFIGURATION.glowColor),
    glowOpacity: glowOpacity !== null ? clamp(glowOpacity, 0, 1) : DEFAULT_LOADER_CONFIGURATION.glowOpacity,
  };
}

/** Converts the configured animation `duration` (ms) into the `speedMultiplier` prop
 * `CrystalPreloader` expects, relative to its baseline timings. */
export function loaderSpeedMultiplier(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return LOADER_SPEED_BASELINE_MS / durationMs;
}

function normalizeCssRgbValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : null;
  if (directHex) return directHex;

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${[r, g, b].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  const spaceSeparated = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (spaceSeparated) {
    const [, r, g, b] = spaceSeparated;
    return `#${[r, g, b].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  return null;
}

function resolveCssColorValue(
  style: Pick<CSSStyleDeclaration, "getPropertyValue"> | null | undefined,
  candidates: string[],
  fallback: string,
): string {
  if (!style) return normalizeHexColor(fallback, DEFAULT_LOADER_CONFIGURATION.primaryColor);

  for (const candidate of candidates) {
    const rawValue = style.getPropertyValue(candidate).trim();
    const normalized = normalizeCssRgbValue(rawValue);
    if (normalized) return normalized;
  }

  return normalizeHexColor(fallback, DEFAULT_LOADER_CONFIGURATION.primaryColor);
}

/** Resolves the loader palette from the current theme CSS variables so the route-level
 * suspense fallback matches the active storefront branding instead of flashing the
 * static purple default while WordPress theme styles are still settling. */
export function resolveThemeAwareLoaderConfiguration(
  fallback: Partial<LoaderConfiguration> | null | undefined = DEFAULT_LOADER_CONFIGURATION,
): LoaderConfiguration {
  const base = normalizeLoaderConfiguration(fallback ?? DEFAULT_LOADER_CONFIGURATION);
  if (typeof document === "undefined") return base;

  const rootStyle = getComputedStyle(document.documentElement);
  return {
    ...base,
    primaryColor: resolveCssColorValue(rootStyle, ["--brand-500", "--brand-400", "--brand-300", "--wp--preset--color--primary"], base.primaryColor),
    glowColor: resolveCssColorValue(rootStyle, ["--brand-600", "--brand-500", "--brand-400", "--wp--preset--color--primary"], base.glowColor),
  };
}

export type LoaderPresentation =
  | { mode: "hidden" }
  | { mode: "crystal" }
  | { mode: "image"; url: string }
  | { mode: "video"; url: string };

/** Decides how the loading state should render for a given (already-normalized) loader
 * configuration: hidden when disabled, the bundled crystal when there's no valid custom
 * media, when the configured media failed to load, or when the visitor prefers reduced
 * motion (custom GIFs/videos can't be paused, so reduced motion always gets the crystal,
 * which itself renders statically per the `prefers-reduced-motion` CSS rules) — and the
 * custom media otherwise. */
export function resolveLoaderPresentation(
  loader: LoaderConfiguration,
  options: { prefersReducedMotion?: boolean; mediaFailed?: boolean } = {},
): LoaderPresentation {
  if (!loader.enabled) return { mode: "hidden" };

  const { prefersReducedMotion = false, mediaFailed = false } = options;
  const mediaKind = mediaFailed ? null : getLoaderMediaKind(loader.customUrl);

  if (!mediaKind || prefersReducedMotion) {
    return { mode: "crystal" };
  }

  return { mode: mediaKind, url: loader.customUrl as string };
}
