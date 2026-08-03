/** Single source of truth for the backend connection — one env var
 * (`VITE_GRAPHQL_ENDPOINT`) instead of the scattered per-feature endpoints this project
 * used to require. Every other backend-derived value (auth, abandoned-cart tracking,
 * shop currency, payment gateways) is computed from this one URL's origin, so wiring up
 * a new environment only ever means setting this single variable. */

const DEVELOPMENT_GRAPHQL_ENDPOINT = "https://v1.superfunky.pro/graphql";
const CONFIGURED_GRAPHQL_ENDPOINT = (import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined)?.trim();
const RAW_GRAPHQL_ENDPOINT = CONFIGURED_GRAPHQL_ENDPOINT || (import.meta.env.DEV ? DEVELOPMENT_GRAPHQL_ENDPOINT : undefined);

/** Full GraphQL endpoint URL. Development defaults to the public FunkyCommerce backend;
 * deployments must configure `VITE_GRAPHQL_ENDPOINT` explicitly. */
export const GRAPHQL_ENDPOINT = RAW_GRAPHQL_ENDPOINT || undefined;

export const isBackendConfigured = Boolean(GRAPHQL_ENDPOINT);

/** The WordPress site's origin (scheme + host, no path) derived from the GraphQL
 * endpoint — e.g. `https://v1.superfunky.pro/graphql` → `https://v1.superfunky.pro`.
 * REST routes (WooCommerce Store API, the abandoned-cart tracker, the sitemap, etc.)
 * all live on this same origin, so nothing needs its own env var. */
export const BACKEND_ORIGIN: string | undefined = GRAPHQL_ENDPOINT ? new URL(GRAPHQL_ENDPOINT, window.location.origin).origin : undefined;

/** Builds an absolute REST URL on the backend origin from a `wp-json`-relative path,
 * e.g. `restUrl("custom/v1/abandoned-cart")` →
 * `https://v1.superfunky.pro/wp-json/custom/v1/abandoned-cart`. Returns `undefined`
 * when no backend is configured. */
export function restUrl(path: string): string | undefined {
  if (!BACKEND_ORIGIN) return undefined;
  const cleanPath = path.replace(/^\/+/, "");
  return `${BACKEND_ORIGIN}/wp-json/${cleanPath}`;
}
