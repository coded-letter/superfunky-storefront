import { useTheme } from "../state/ThemeContext";
import { useOptionalCookieConsent } from "../state/CookieConsentContext";
import { useEffect, useRef, useState } from "react";
import { parseSpotifyReference } from "./spotifyEmbed";

export type SpotifyContentType = "track" | "album" | "playlist" | "artist" | "show" | "episode";

export type SpotifyPlayerMockProps = {
  /** A Spotify ID (`37i9dQZF1DXcBWIGoYBM5M`), a `spotify:playlist:...` URI, or a full
   * `https://open.spotify.com/playlist/...` share link — whichever is easiest to paste
   * from Spotify's own "Share → Copy link/URI" menu. When a URI/URL is given, its
   * content type is inferred automatically and `contentType` below is only needed for
   * bare IDs. */
  uri?: string;
  /** Overrides the inferred content type — required when `uri` is a bare ID rather
   * than a full `spotify:` URI or `open.spotify.com` link. */
  contentType?: SpotifyContentType;
  /** Pixel height of the embed. Falls back to Spotify's own recommended height per
   * content type (compact for tracks/episodes, taller for playlists) when omitted. */
  height?: number;
  /** `"auto"` (default) follows the storefront's own dark/light mode via `useTheme()`;
   * pass an explicit value to pin the player to one look regardless of site theme. */
  theme?: "auto" | "dark" | "light";
  title?: string;
};

const DEFAULT_URI = "37i9dQZF1DWWQRwui0ExPn"; // Spotify's own "Lo-Fi Beats" playlist (instrumental jazz-hop) — swap for a branded one anytime.

const DEFAULT_HEIGHTS: Record<SpotifyContentType, number> = {
  track: 152,
  episode: 232,
  show: 232,
  album: 352,
  artist: 352,
  playlist: 400,
};

/** Spotify's current ("Encore") embed generator output — a single responsive iframe,
 * no SDK/npm package required (Spotify doesn't ship an official React component). This
 * replaces the legacy prototype's hardcoded album-only, fixed-height iframe with one
 * that accepts any content type/link and syncs its light/dark chrome to the storefront
 * theme automatically. */
export function SpotifyPlayerMock({
  uri = DEFAULT_URI,
  contentType,
  height,
  theme = "auto",
  title = "Spotify player",
}: SpotifyPlayerMockProps) {
  const { isDarkMode } = useTheme();
  const consentContext = useOptionalCookieConsent();
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const resolvedReference = parseSpotifyReference(uri, contentType);
  const resolvedType = resolvedReference?.contentType ?? contentType ?? "playlist";
  const resolvedHeight = height ?? DEFAULT_HEIGHTS[resolvedType] ?? DEFAULT_HEIGHTS.playlist;
  const isDark = theme === "auto" ? isDarkMode : theme === "dark";
  const canLoadThirdPartyMedia = consentContext?.consent?.marketing === true;

  useEffect(() => {
    const target = containerRef.current;
    if (!target || !resolvedReference || !canLoadThirdPartyMedia || shouldLoad) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      }, { rootMargin: "0px" });
      observer.observe(target);
      return () => observer.disconnect();
    }

    const fallbackId = setTimeout(() => setShouldLoad(true), 0);
    return () => clearTimeout(fallbackId);
  }, [canLoadThirdPartyMedia, resolvedReference?.contentType, resolvedReference?.id, shouldLoad]);

  if (!resolvedReference) return null;

  const src = `https://open.spotify.com/embed/${resolvedReference.contentType}/${resolvedReference.id}?utm_source=generator${isDark ? "&theme=0" : ""}`;
  return (
    <div
      ref={containerRef}
      className="sf-spotify-player funky-spotify-player flex w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-center dark:bg-zinc-900"
      style={{ height: resolvedHeight }}
      role="group"
      aria-label={
        shouldLoad
          ? undefined
          : canLoadThirdPartyMedia
            ? `${title} will load in the viewport`
            : `${title} requires marketing cookie consent`
      }
    >
      {shouldLoad ? (
        <iframe
          title={title}
          src={src}
          width="100%"
          height={resolvedHeight}
          style={{ border: 0, borderRadius: "12px" }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      ) : (
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-[#1ed760]" />
          Spotify
        </span>
      )}
    </div>
  );
}
