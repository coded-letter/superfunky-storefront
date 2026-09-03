export const NAVIGATION_DATA_CACHE_VERSION = 16;

export function navigationDataCacheKey(languageCode) {
  return `navigation-data:v${NAVIGATION_DATA_CACHE_VERSION}:${languageCode}`;
}
