const STOREFRONT_PROXIED_MEDIA_PATH = /^\/wp-content\/uploads\/.+\.(?:pdf|glb)$/i;

export function isStorefrontProxiedMediaPath(pathname: string): boolean {
  return STOREFRONT_PROXIED_MEDIA_PATH.test(pathname);
}

export function storefrontProxiedMediaUrl(
  source: string,
  {
    backendOrigin,
    baseUrl,
  }: {
    backendOrigin: string | undefined;
    baseUrl: string;
  },
): string | null {
  if (!backendOrigin) return null;
  try {
    const mediaUrl = new URL(source, baseUrl);
    if (
      mediaUrl.origin !== new URL(backendOrigin).origin
      || !isStorefrontProxiedMediaPath(mediaUrl.pathname)
    ) {
      return null;
    }
    return `${mediaUrl.pathname}${mediaUrl.search}${mediaUrl.hash}`;
  } catch {
    return null;
  }
}
