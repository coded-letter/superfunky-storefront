const AUTH_PATH = /^\/(?:[^/?#]+\/)?(?:auth(?:\/|$)|oauth\/login(?:\/|$))/i;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const BACKSLASH = /\\/;
const OAUTH_REF_PREFIX = "funkycommerce-oauth-ref:";

/** Accepts only an in-store path which cannot send a visitor back into authentication. */
export function parseStorefrontAuthRef(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || BACKSLASH.test(value) || CONTROL_CHARACTER.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//")
      || BACKSLASH.test(decoded)
      || CONTROL_CHARACTER.test(decoded)
    ) return null;
    const decodedUrl = new URL(decoded, "https://storefront.invalid");
    if (decodedUrl.origin !== "https://storefront.invalid" || AUTH_PATH.test(decodedUrl.pathname)) return null;

    const url = new URL(value, "https://storefront.invalid");
    if (url.origin !== "https://storefront.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function withStorefrontAuthRef(path: string, ref: string | null): string {
  if (!ref) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}ref=${encodeURIComponent(ref)}`;
}

export function oauthStateFromAuthorizationUrl(authorizationUrl: string): string | null {
  try {
    return new URL(authorizationUrl).searchParams.get("state");
  } catch {
    return null;
  }
}

export function storeOAuthAuthRef(state: string | null, ref: string | null): void {
  if (!state || !ref || typeof window === "undefined") return;
  window.sessionStorage.setItem(`${OAUTH_REF_PREFIX}${state}`, ref);
}

export function consumeOAuthAuthRef(state: string | null | undefined): string | null {
  if (!state || typeof window === "undefined") return null;
  const key = `${OAUTH_REF_PREFIX}${state}`;
  const ref = parseStorefrontAuthRef(window.sessionStorage.getItem(key));
  window.sessionStorage.removeItem(key);
  return ref;
}
