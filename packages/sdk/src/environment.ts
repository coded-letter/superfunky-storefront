/** Single source of truth for the backend connection. Every backend-derived URL is
 * computed from `VITE_GRAPHQL_ENDPOINT`; the optional profile only prevents known-absent
 * feature families from issuing eager discovery requests. */

const DEFAULT_GRAPHQL_ENDPOINT = "https://dev.superfunky.pro/graphql";
const IMPORT_META_ENV = import.meta.env ?? {};
const NODE_ENV = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;
const CONFIGURED_GRAPHQL_ENDPOINT = (IMPORT_META_ENV.VITE_GRAPHQL_ENDPOINT || NODE_ENV?.VITE_GRAPHQL_ENDPOINT)?.trim();
const RAW_GRAPHQL_ENDPOINT = CONFIGURED_GRAPHQL_ENDPOINT || DEFAULT_GRAPHQL_ENDPOINT;

/** Full GraphQL endpoint URL. Managed deployments may override the current v3
 * WordPress backend, but an omitted build variable must not produce a broken shop. */
export const GRAPHQL_ENDPOINT = RAW_GRAPHQL_ENDPOINT || undefined;

export const isBackendConfigured = Boolean(GRAPHQL_ENDPOINT);

export type StorefrontBackendProfile = "shell" | "blog" | "shop" | "full";
const STOREFRONT_BACKEND_PROFILES: readonly StorefrontBackendProfile[] = ["shell", "blog", "shop", "full"];

const configuredBackendProfile = (
  IMPORT_META_ENV.VITE_BACKEND_PROFILE
  || NODE_ENV?.VITE_BACKEND_PROFILE
  || "full"
).trim().toLowerCase();

const isStorefrontBackendProfile = (value: string): value is StorefrontBackendProfile =>
  STOREFRONT_BACKEND_PROFILES.some((profile) => profile === value);

export const STOREFRONT_BACKEND_PROFILE: StorefrontBackendProfile = isStorefrontBackendProfile(configuredBackendProfile)
  ? configuredBackendProfile
  : "full";

export const STOREFRONT_DEFAULT_LANGUAGE = (
  IMPORT_META_ENV.VITE_DEFAULT_LANGUAGE
  || NODE_ENV?.VITE_DEFAULT_LANGUAGE
  || "en"
).trim().toLowerCase();

export const STOREFRONT_EXPECTED_LOCALES = [
  ...new Set(
    (
      IMPORT_META_ENV.STOREFRONT_EXPECTED_LOCALES
      || NODE_ENV?.STOREFRONT_EXPECTED_LOCALES
      || STOREFRONT_DEFAULT_LANGUAGE
    )
      .split(",")
      .map((locale) => locale.trim().toLowerCase())
      .filter(Boolean),
  ),
];

/** The WordPress site's origin (scheme + host, no path) derived from the GraphQL
 * endpoint — e.g. `https://v1.superfunky.pro/graphql` → `https://v1.superfunky.pro`.
 * REST routes (WooCommerce Store API, the abandoned-cart tracker, the sitemap, etc.)
 * all live on this same origin, so nothing needs its own env var. */
export const BACKEND_ORIGIN: string | undefined = GRAPHQL_ENDPOINT
  ? new URL(GRAPHQL_ENDPOINT, typeof window === "undefined" ? "http://localhost" : window.location.origin).origin
  : undefined;

/** The WordPress installation base URL, preserving a subdirectory such as
 * `https://example.test/aqua-bar-wp/` from a GraphQL endpoint below it. */
export const BACKEND_BASE_URL: string | undefined = GRAPHQL_ENDPOINT
  ? (() => {
      const endpoint = new URL(
        GRAPHQL_ENDPOINT,
        typeof window === "undefined" ? "http://localhost" : window.location.origin,
      );
      endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");
      return new URL(".", endpoint).toString();
    })()
  : undefined;
export const BACKEND_BASE_PATH = BACKEND_BASE_URL
  ? new URL(BACKEND_BASE_URL).pathname.replace(/\/+$/, "")
  : "";

/** Builds an absolute REST URL on the backend origin from a `wp-json`-relative path,
 * e.g. `restUrl("custom/v1/abandoned-cart")` →
 * `https://v1.superfunky.pro/wp-json/custom/v1/abandoned-cart`. Returns `undefined`
 * when no backend is configured. */
export function restUrl(path: string): string | undefined {
  if (!BACKEND_BASE_URL) return undefined;
  const cleanPath = path.replace(/^\/+/, "");
  return new URL(`wp-json/${cleanPath}`, BACKEND_BASE_URL).toString();
}

/** Builds an absolute URL relative to the WordPress installation base. */
export function backendUrl(path: string): string | undefined {
  if (!BACKEND_BASE_URL) return undefined;
  return new URL(path.replace(/^\/+/, ""), BACKEND_BASE_URL).toString();
}

/** Converts a backend permalink into a storefront path by removing the
 * WordPress installation directory from its pathname. */
export function backendPathFromUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value, BACKEND_BASE_URL || "http://localhost");
    const basePath = BACKEND_BASE_PATH;
    if (
      basePath
      && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))
    ) {
      const path = url.pathname.slice(basePath.length) || "/";
      return path.startsWith("/") ? path : `/${path}`;
    }
    return url.pathname || fallback;
  } catch {
    return fallback;
  }
}
