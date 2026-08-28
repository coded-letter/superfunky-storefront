export const NAVIGATION_DATA_CACHE_VERSION = 15;

export function navigationDataCacheKey(languageCode) {
  return `navigation-data:v${NAVIGATION_DATA_CACHE_VERSION}:${languageCode}`;
}
