import { useEffect, useState, type CSSProperties } from "react";
import {
  getLoaderMediaKind,
  loaderSpeedMultiplier,
  resolveLoaderPresentation,
  type LoaderConfiguration,
} from "../lib/loaderConfig";
import { CrystalPreloader } from "./CrystalPreloader";

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

export type StorefrontPreloaderProps = {
  loader: LoaderConfiguration;
  className?: string;
  style?: CSSProperties;
  /** Accessible label for the loading indicator. */
  label?: string;
};

/** Renders the Control Center's "Loading animation" settings: a custom GIF/SVG/WebP/PNG
 * or video asset when configured and valid, falling back to the bundled `CrystalPreloader`
 * when the custom media is missing, fails to load, or the visitor prefers reduced motion
 * (custom media can't be paused the way the crystal's CSS animations can). Renders
 * nothing when the loading animation is disabled in the Control Center. */
export function StorefrontPreloader({ loader, className = "", style, label = "Loading" }: StorefrontPreloaderProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [mediaFailed, setMediaFailed] = useState(false);

  const presentation = resolveLoaderPresentation(loader, { prefersReducedMotion, mediaFailed });

  if (presentation.mode === "hidden") return null;

  if (presentation.mode === "crystal") {
    return (
      <span className={className} style={style} role="status" aria-live="polite">
        <CrystalPreloader
          color={loader.primaryColor}
          glowColor={loader.glowColor}
          glowOpacity={loader.glowOpacity}
          size={loader.size}
          speedMultiplier={loaderSpeedMultiplier(loader.duration)}
        />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  const mediaStyle: CSSProperties = { height: loader.size, width: loader.size, objectFit: "contain" };

  if (presentation.mode === "video") {
    return (
      <span className={className} style={style} role="status" aria-live="polite">
        <video
          src={presentation.url}
          style={mediaStyle}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          onError={() => setMediaFailed(true)}
        />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span className={className} style={style} role="status" aria-live="polite">
      <img
        src={presentation.url}
        style={mediaStyle}
        alt=""
        aria-hidden="true"
        onError={() => setMediaFailed(true)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Re-exported so callers that only need to check media support (e.g. preloading a
// custom asset) don't need a separate import from `lib/loaderConfig`.
export { getLoaderMediaKind };
