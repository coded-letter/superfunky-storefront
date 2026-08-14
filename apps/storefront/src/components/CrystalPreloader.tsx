import type { CSSProperties } from "react";

export type CrystalPreloaderProps = {
  className?: string;
  color?: string;
  /** Crystal height. Defaults to 30px. */
  size?: number | string;
  speedMultiplier?: number;
  /** Ambient glow color. Defaults to the crystal's own `color`. */
  glowColor?: string;
  /** Glow opacity multiplier (0–1). Defaults to the CSS baseline (~0.16). */
  glowOpacity?: number;
  style?: CSSProperties;
};

export function CrystalPreloader({
  className = "",
  color,
  size = 30,
  speedMultiplier = 1,
  glowColor,
  glowOpacity,
  style,
}: CrystalPreloaderProps) {
  const variables = {
    "--crystal-color": color || "var(--wp--preset--color--primary, var(--color-brand-500, rgb(var(--brand-500))))",
    "--crystal-size": typeof size === "number" ? `${size}px` : size,
    "--crystal-speed": Math.max(0.25, speedMultiplier),
    ...(glowColor ? { "--crystal-glow-color": glowColor } : {}),
    ...(typeof glowOpacity === "number" ? { "--crystal-glow-opacity": glowOpacity } : {}),
    ...style,
  } as CSSProperties;


  return (
    <span className={`sf-loader funky-crystal-preloader ${className}`} style={variables} aria-hidden="true" data-crystal-axis="y">
      <span className="funky-crystal-preloader__motion">
        <span className="funky-crystal-preloader__glow" />
        <span className="funky-crystal-preloader__solid">
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--upper funky-crystal-preloader__face--north" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--upper funky-crystal-preloader__face--east" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--upper funky-crystal-preloader__face--south" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--upper funky-crystal-preloader__face--west" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--lower funky-crystal-preloader__face--north" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--lower funky-crystal-preloader__face--east" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--lower funky-crystal-preloader__face--south" />
          <span className="funky-crystal-preloader__face funky-crystal-preloader__face--lower funky-crystal-preloader__face--west" />
        </span>
      </span>
    </span>
  );
}
