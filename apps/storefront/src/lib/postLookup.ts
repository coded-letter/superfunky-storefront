export type PostLookupIdentifierType = "URI" | "SLUG";

export async function requestPostWithSlugFallback<T>(
  uri: string,
  request: (identifier: string, idType: PostLookupIdentifierType) => Promise<T>,
  isMissing: (result: T) => boolean,
): Promise<T> {
  const response = await request(uri, "URI");
  if (!isMissing(response)) return response;

  const slug = postSlugFromUri(uri);
  return slug ? request(slug, "SLUG") : response;
}

export function postSlugFromUri(uri: string): string | null {
  const encodedSlug = uri.split(/[?#]/, 1)[0].split("/").filter(Boolean).at(-1);
  if (!encodedSlug) return null;
  try {
    return decodeURIComponent(encodedSlug);
  } catch {
    return encodedSlug;
  }
}
