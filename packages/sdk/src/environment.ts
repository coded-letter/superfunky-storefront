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

/** Builds an absolute REST URL on the backend origin from a `wp-json`-relative path,
 * e.g. `restUrl("custom/v1/abandoned-cart")` →
 * `https://v1.superfunky.pro/wp-json/custom/v1/abandoned-cart`. Returns `undefined`
 * when no backend is configured. */
export function restUrl(path: string): string | undefined {
  if (!BACKEND_ORIGIN) return undefined;
  const cleanPath = path.replace(/^\/+/, "");
  return `${BACKEND_ORIGIN}/wp-json/${cleanPath}`;
}
