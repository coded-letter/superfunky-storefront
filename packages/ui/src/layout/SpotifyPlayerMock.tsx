import { useTheme } from "../state/ThemeContext";

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

/** Parses any of the three copy-paste formats Spotify's own share menu produces into
 * `{ contentType, id }`, falling back to `explicitType`/`"playlist"` for bare IDs. */
function parseSpotifyReference(
  reference: string,
  explicitType?: SpotifyContentType
): { contentType: SpotifyContentType; id: string } {
  const trimmed = reference.trim();

  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  if (trimmed.startsWith("spotify:")) {
    const [, type, id] = trimmed.split(":");
    if (type && id) return { contentType: type as SpotifyContentType, id };
  }

  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  if (trimmed.includes("open.spotify.com/")) {
    const path = trimmed.split("open.spotify.com/")[1]?.split("?")[0] ?? "";
    const [type, id] = path.split("/").filter(Boolean);
    if (type && id) return { contentType: type as SpotifyContentType, id };
  }

  // Bare ID — rely on the explicit/default content type.
  return { contentType: explicitType ?? "playlist", id: trimmed };
}

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
  const { contentType: resolvedType, id } = parseSpotifyReference(uri, contentType);
  const resolvedHeight = height ?? DEFAULT_HEIGHTS[resolvedType] ?? DEFAULT_HEIGHTS.playlist;
  const isDark = theme === "auto" ? isDarkMode : theme === "dark";

  const src = `https://open.spotify.com/embed/${resolvedType}/${id}?utm_source=generator${isDark ? "&theme=0" : ""}`;

  return (
    <iframe
      title={title}
      src={src}
      width="100%"
      height={resolvedHeight}
      style={{ borderRadius: "12px" }}
      frameBorder="0"
      allowFullScreen
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="funky-spotify-player w-full"
    />
  );
}
