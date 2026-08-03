/** Frontend geolocation lookup — a cleaned-up TypeScript rewrite of the legacy
 * prototype's `geolocation.js`. The original hardcoded a single country ("PL") as the
 * only "interesting" response, presumably to gate a Poland-specific payment method
 * (BLIK) or shipping notice; this version returns whatever country code the endpoint
 * reports and lets the caller decide what to do with it (see `checkout` page's BLIK
 * method, which can use this to auto-suggest itself for Polish visitors once wired up).
 * Safe to call with no endpoint configured — resolves to `null` rather than hitting a
 * route that doesn't exist yet. */

const GEOLOCATION_ENDPOINT = (import.meta.env.VITE_GEOLOCATION_ENDPOINT as string | undefined) ?? "/geolocation";

export const isGeolocationBackendConfigured = Boolean(import.meta.env.VITE_GEOLOCATION_ENDPOINT);

export type GeolocationResult = {
  countryCode: string | null;
};

/** Fetches the visitor's country code from a (typically CDN/edge-injected) geolocation
 * endpoint. Always resolves — never throws — since this is a "nice to have" signal
 * (e.g. defaulting the checkout country field, or surfacing a locale-specific banner),
 * not something a page should ever block rendering on. */
export async function fetchGeolocation(): Promise<GeolocationResult> {
  if (typeof window === "undefined" || !isGeolocationBackendConfigured) {
    return { countryCode: null };
  }

  try {
    const response = await fetch(GEOLOCATION_ENDPOINT);
    const data = (await response.json()) as { geo?: { country?: { code?: string } } };
    return { countryCode: data?.geo?.country?.code ?? null };
  } catch {
    return { countryCode: null };
  }
}
