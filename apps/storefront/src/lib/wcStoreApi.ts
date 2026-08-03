/** Minimal WooCommerce Store API client — the REST layer (same origin as
 * `VITE_GRAPHQL_ENDPOINT`, reached via `/wp-json/wc/store/v1/...`) that actually
 * carries cart/checkout/payment state, as distinct from WPGraphQL (which only exposes
 * read-only shop data like products/settings on this backend).
 *
 * Headless auth model: the Store API identifies an anonymous cart via a `Cart-Token`
 * response header (replay it as a request header on later calls instead of relying on
 * cookies, which don't survive cross-origin requests) and requires a `Nonce` response
 * header to be replayed for state-changing requests (POST/PUT/PATCH/DELETE).
 *
 * KNOWN LIMITATION (confirmed live against v1.superfunky.pro): this backend's actual
 * GET/POST responses send `Access-Control-Expose-Headers:` empty, so cross-origin
 * `fetch()` cannot read the `Cart-Token`/`Nonce` response headers at all (only the CORS
 * *preflight* response lists them as allowed — that doesn't help). Until the backend
 * adds those two header names to `Access-Control-Expose-Headers` (a one-line WordPress
 * fix, e.g. hooking `rest_pre_serve_request`), every cross-origin call here behaves as
 * a fresh anonymous session with no nonce — fine for read-only calls (shop currency),
 * not enough for a real stateful add-to-cart/checkout flow. This client still
 * implements the correct/standard flow so it starts working automatically the moment
 * that header is exposed, and warns once in dev instead of failing silently. */

import { BACKEND_ORIGIN, isBackendConfigured } from "./env";

const CART_TOKEN_STORAGE_KEY = "funkycommerce-wc-cart-token";

let cachedNonce: string | null = null;
let warnedAboutMissingHeaders = false;

function storeApiUrl(route: string): string | undefined {
  if (!BACKEND_ORIGIN) return undefined;
  return `${BACKEND_ORIGIN}/index.php?rest_route=/wc/store/v1/${route.replace(/^\/+/, "")}`;
}

function getStoredCartToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(CART_TOKEN_STORAGE_KEY);
}

function setStoredCartToken(token: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CART_TOKEN_STORAGE_KEY, token);
}

function warnAboutMissingHeadersOnce(): void {
  if (warnedAboutMissingHeaders || !import.meta.env.DEV) return;
  warnedAboutMissingHeaders = true;
  console.warn(
    "[wcStoreApi] The backend didn't expose Cart-Token/Nonce response headers via CORS " +
      "(Access-Control-Expose-Headers). Stateful cart/checkout calls will behave as a " +
      "fresh anonymous session each time until the backend adds those header names to " +
      "that CORS response header.",
  );
}

export type StoreApiResponse<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Executes a Store API request, persisting the `Cart-Token` header across calls
 * (falls back to a fresh anonymous cart each time if the backend doesn't expose it —
 * see the module-level comment) and attaching the `Nonce` header for state-changing
 * methods. Resolves to a not-ok result (never throws) with no network call when no
 * backend is configured. */
export async function storeApiRequest<T>(route: string, init?: { method?: string; body?: unknown }): Promise<StoreApiResponse<T>> {
  const url = storeApiUrl(route);
  if (!isBackendConfigured || !url) {
    return { ok: false, status: 0, error: "No backend configured (VITE_GRAPHQL_ENDPOINT)" };
  }

  const method = init?.method ?? "GET";
  const isStateChanging = method !== "GET" && method !== "HEAD";
  const cartToken = getStoredCartToken();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cartToken ? { "Cart-Token": cartToken } : {}),
        ...(isStateChanging && cachedNonce ? { Nonce: cachedNonce } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    const newCartToken = response.headers.get("cart-token");
    const newNonce = response.headers.get("nonce");
    if (newCartToken) setStoredCartToken(newCartToken);
    else if (isStateChanging || !cartToken) warnAboutMissingHeadersOnce();
    if (newNonce) cachedNonce = newNonce;

    const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
    if (!response.ok) {
      const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" ? payload.message : `Store API request failed with status ${response.status}`;
      return { ok: false, status: response.status, error: message };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Store API request failed" };
  }
}

export type StoreApiCartTotals = {
  total_items?: string;
  total_items_tax?: string;
  total_fees?: string;
  total_fees_tax?: string;
  total_discount?: string;
  total_discount_tax?: string;
  total_shipping?: string | null;
  total_shipping_tax?: string | null;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
  total_price: string;
  total_tax?: string;
  tax_lines?: Array<{ name: string; price: string }>;
};

export type StoreApiCartItem = {
  key: string;
  id: number;
  quantity: number;
  name: string;
  sku: string;
  price: string;
  product_id: number;
  variation_id: number;
  images: { id: number; src: string; thumbnail: string; srcset: string; alt: string }[];
  virtual?: boolean;
};

export type StoreApiCart = {
  coupons?: { code: string; label: string }[];
  items?: StoreApiCartItem[];
  shipping_rates?: StoreApiShippingOption[];
  payment_methods?: string[];
  needs_shipping?: boolean;
  has_calculated_shipping?: boolean;
  itemsCount?: number;
  itemsWeight?: number;
  totals: StoreApiCartTotals;
};

/** Fetches the live WooCommerce cart (creating a fresh anonymous one if none exists
 * yet) — this is the authoritative source for shop currency (`totals.currency_code`,
 * `currency_symbol`, decimal/thousand separators) since it's public/unauthenticated and
 * always reflects the store's actual configured currency, unlike a hardcoded env var. */
export function getCart(): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart");
}

/** Alias for backward compatibility. */
export function getCartTotals(): Promise<StoreApiResponse<StoreApiCart>> {
  return getCart();
}

export type StoreApiAddToCartPayload = {
  id: number;
  quantity: number;
  variation?: Record<string, string | number>;
};

/** Adds an item to the WooCommerce cart. Returns the updated cart. */
export function addToCart(item: StoreApiAddToCartPayload): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/add-item", { method: "POST", body: item });
}

export type StoreApiUpdateCartItemPayload = {
  key: string;
  quantity: number;
};

/** Updates a cart item's quantity. Returns the updated cart. */
export function updateCartItem(item: StoreApiUpdateCartItemPayload): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/update-item", { method: "POST", body: item });
}

/** Removes an item from the cart by its unique cart key. Returns the updated cart. */
export function removeFromCart(key: string): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/remove-item", { method: "POST", body: { key } });
}

export type StoreApiAddress = {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
};

export type StoreApiCheckoutPayload = {
  billing_address: StoreApiAddress;
  shipping_address?: StoreApiAddress;
  payment_method: "stripe" | "stripe_blik" | "cod" | "cheque" | "bacs" | "funkycommerce_crypto";
  payment_data?: { key: string; value: string }[];
  customer_note?: string;
  create_account?: boolean;
  customer_id?: number;
  subscribe_to_newsletter?: boolean;
};

export type StoreApiCheckoutResult = {
  order_id: number;
  order_key?: string;
  order_number?: string;
  status: string;
  payment_method?: string;
  billing_address?: StoreApiAddress;
  shipping_address?: StoreApiAddress;
  payment_result: {
    payment_status: "success" | "failure" | "pending" | "error";
    payment_details: { key: string; value: string }[];
    redirect_url: string;
  };
};

/** Submits the WooCommerce Store API checkout — this is the real, standard REST call
 * the WooCommerce Stripe Gateway plugin (and its BLIK sub-method, `stripe_blik`) hook
 * into on the backend, replacing the legacy prototype's raw-secret-key Netlify
 * function. On success, `payment_result.payment_details` carries whatever the active
 * gateway needs client-side to finish confirmation (e.g. a Stripe `client_secret`). */
export function submitStoreCheckout(payload: StoreApiCheckoutPayload): Promise<StoreApiResponse<StoreApiCheckoutResult>> {
  return storeApiRequest<StoreApiCheckoutResult>("checkout", { method: "POST", body: payload });
}

export type StoreApiShippingMethod = {
  id: string;
  name: string;
  description: string;
  delivery_time: string;
  price: string;
  rate: string;
  taxes: string;
  choice_disabled: boolean;
  /** Only present if this is the currently selected method */
  selected?: boolean;
};

export type StoreApiShippingOption = {
  package_id: number;
  name: string;
  destination: {
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  items: Array<{ key: string; name: string; quantity: number }>;
  shipping_methods: StoreApiShippingMethod[];
};

/** Syncs the current cart customer addresses, allowing WooCommerce to recalculate
 * shipping/tax/payment availability for the active anonymous cart session. */
export function updateCartCustomer(address: StoreApiAddress): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/update-customer", {
    method: "POST",
    body: {
      billing_address: address,
      shipping_address: address,
    },
  });
}

/** Fetches available shipping methods for the current cart after syncing the address. */
export async function getShippingMethods(address: StoreApiAddress): Promise<StoreApiResponse<StoreApiShippingOption[]>> {
  const updated = await updateCartCustomer(address);
  if (!updated.ok) return updated;
  return { ok: true, data: updated.data.shipping_rates ?? [] };
}

/** Selects a specific shipping method for the cart. */
export function selectShippingMethod(method: { package_id: number; rate_id: string }): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/select-shipping-rate", { method: "POST", body: method });
}

export type StoreApiCouponResponse = {
  totals: StoreApiCartTotals;
  errors?: Array<{ code: string; message: string }>;
};

/** Applies a coupon code to the cart. */
export function applyCoupon(code: string): Promise<StoreApiResponse<StoreApiCouponResponse>> {
  return storeApiRequest<StoreApiCouponResponse>("cart/apply-coupon", { method: "POST", body: { code } });
}

/** Removes a coupon code from the cart. */
export function removeCoupon(code: string): Promise<StoreApiResponse<StoreApiCouponResponse>> {
  return storeApiRequest<StoreApiCouponResponse>("cart/remove-coupon", { method: "POST", body: { code } });
}

export type StoreApiTaxResult = {
  totals: StoreApiCartTotals;
  tax_total: string;
  tax_lines: Array<{ name: string; price: string }>;
};

/** Calculates taxes for the cart based on the billing/shipping address. */
export async function calculateTaxes(address: StoreApiAddress): Promise<StoreApiResponse<StoreApiTaxResult>> {
  const updated = await updateCartCustomer(address);
  if (!updated.ok) return updated;
  const totals = updated.data.totals;
  return {
    ok: true,
    data: {
      totals,
      tax_total: totals.total_tax ?? "0",
      tax_lines: totals.tax_lines ?? [],
    },
  };
}
