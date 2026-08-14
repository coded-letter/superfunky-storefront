import type { SpotifyContentType } from "./SpotifyPlayerMock";

const SPOTIFY_CONTENT_TYPES = new Set<SpotifyContentType>([
  "track",
  "album",
  "playlist",
  "artist",
  "show",
  "episode",
]);
const SPOTIFY_ID = /^[A-Za-z0-9]{10,64}$/;

export function parseSpotifyReference(
  reference: string,
  explicitType?: SpotifyContentType,
): { contentType: SpotifyContentType; id: string } | null {
  const trimmed = reference.trim();
  let contentType = explicitType ?? "playlist";
  let id = trimmed;

  if (trimmed.startsWith("spotify:")) {
    const [, type, parsedId] = trimmed.split(":");
    contentType = type as SpotifyContentType;
    id = parsedId ?? "";
  } else {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
      const [type, parsedId] = url.pathname.split("/").filter(Boolean);
      contentType = type as SpotifyContentType;
      id = parsedId ?? "";
    } catch {
      // Bare Spotify IDs are valid with an explicit/default content type.
    }
  }

  return SPOTIFY_CONTENT_TYPES.has(contentType) && SPOTIFY_ID.test(id)
    ? { contentType, id }
    : null;
}
