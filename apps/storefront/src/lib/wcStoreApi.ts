/** Minimal WooCommerce Store API client — the REST layer (same origin as
 * `VITE_GRAPHQL_ENDPOINT`, reached via `/wp-json/wc/store/v1/...`) that actually
 * carries cart/checkout/payment state, as distinct from WPGraphQL (which only exposes
 * read-only shop data like products/settings on this backend).
 *
 * Headless auth model: the Store API identifies a cart via a `Cart-Token` (cookies
 * don't survive cross-origin requests), while logged-in requests also carry the
 * WPGraphQL Login bearer token so WooCommerce can assign orders to the current user.
 * A `Nonce` is only needed when there is not yet a Cart-Token; sending both can make
 * concurrent requests race on a rotating nonce. */

import { BACKEND_ORIGIN, isBackendConfigured } from "@funky/sdk";
import { normalizeBackendError } from "@funky/ui";
import { getAuthTokenForRequest } from "./auth";
import { buildStoreApiHeaders, isStoreApiNonceError } from "./storeApiAuth";

const CART_TOKEN_STORAGE_KEY = "funkycommerce-wc-cart-token";

let cachedNonce: string | null = null;
let warnedAboutMissingHeaders = false;
let mutationQueue: Promise<void> = Promise.resolve();
let sessionInitialization: Promise<StoreApiResponse<StoreApiCart>> | null = null;

function storeApiUrl(route: string): string | undefined {
  if (!BACKEND_ORIGIN) return undefined;
  const [path, query = ""] = route.split("?", 2);
  const url = new URL(`${BACKEND_ORIGIN}/index.php`);
  url.searchParams.set("rest_route", `/wc/store/v1/${path.replace(/^\/+/, "")}`);
  new URLSearchParams(query).forEach((value, key) => url.searchParams.append(key, value));
  return url.toString();
}

function getStoredCartToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(CART_TOKEN_STORAGE_KEY);
}

function setStoredCartToken(token: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CART_TOKEN_STORAGE_KEY, token);
}

function applyStoreApiSessionHeaders(response: Response): void {
  const newCartToken = response.headers.get("cart-token");
  const newNonce = response.headers.get("nonce");
  if (newCartToken) setStoredCartToken(newCartToken);
  if (newNonce) cachedNonce = newNonce;
}

async function initializeStoreApiSession(): Promise<StoreApiResponse<StoreApiCart>> {
  const url = storeApiUrl("cart");
  if (!url) return { ok: false, status: 0, error: "No backend configured (VITE_GRAPHQL_ENDPOINT)" };
  if (sessionInitialization) return sessionInitialization;

  sessionInitialization = (async () => {
    try {
      const authToken = await getAuthTokenForRequest();
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: buildStoreApiHeaders({
          authToken,
          cartToken: getStoredCartToken(),
          nonce: null,
          isStateChanging: false,
        }),
      });
      applyStoreApiSessionHeaders(response);
      const payload = (await response.json().catch(() => null)) as StoreApiCart | { message?: string } | null;
      if (!response.ok) {
        const message = payload && "message" in payload && typeof payload.message === "string"
          ? normalizeBackendError(payload.message)
          : `Store API request failed with status ${response.status}`;
        return { ok: false, status: response.status, error: message };
      }
      if (!getStoredCartToken() && !cachedNonce) warnAboutMissingHeadersOnce();
      return { ok: true, data: payload as StoreApiCart };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "Store API session initialization failed",
      };
    } finally {
      sessionInitialization = null;
    }
  })();

  return sessionInitialization;
}

/** Drops an invalid anonymous Store API session. The next cart read creates a fresh
 * WooCommerce cart and obtains a new Cart-Token/Nonce pair. */
export function resetStoreApiSession(): void {
  cachedNonce = null;
  sessionInitialization = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(CART_TOKEN_STORAGE_KEY);
  }
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

/** Executes a Store API request, persisting the `Cart-Token` across calls and
 * serializing mutations so response tokens/nonces cannot be applied out of order.
 * Resolves to a not-ok result (never throws) with no network call when no backend is
 * configured. */
export async function storeApiRequest<T>(
  route: string,
  init?: { method?: string; body?: unknown; requireAuthenticatedUser?: boolean },
): Promise<StoreApiResponse<T>> {
  const url = storeApiUrl(route);
  if (!isBackendConfigured || !url) {
    return { ok: false, status: 0, error: "No backend configured (VITE_GRAPHQL_ENDPOINT)" };
  }

  const method = init?.method ?? "GET";
  const isStateChanging = method !== "GET" && method !== "HEAD";
  const execute = async (retryNonce = true): Promise<StoreApiResponse<T>> => {
    if (isStateChanging && !getStoredCartToken() && !cachedNonce) {
      const initialized = await initializeStoreApiSession();
      if (!initialized.ok) return initialized;
    }

    const cartToken = getStoredCartToken();
    const authToken = await getAuthTokenForRequest();
    if (init?.requireAuthenticatedUser && !authToken) {
      return {
        ok: false,
        status: 401,
        error: "Your account session expired. Sign in again before placing the order.",
      };
    }
    try {
      const response = await fetch(url, {
        method,
        cache: "no-store",
        headers: buildStoreApiHeaders({
          authToken,
          cartToken,
          nonce: cachedNonce,
          isStateChanging,
        }),
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });

      applyStoreApiSessionHeaders(response);
      if (!response.headers.get("cart-token") && (isStateChanging || !cartToken)) warnAboutMissingHeadersOnce();

      const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? normalizeBackendError(payload.message)
          : `Store API request failed with status ${response.status}`;
        if (isStateChanging && retryNonce && isStoreApiNonceError(message)) {
          resetStoreApiSession();
          const initialized = await initializeStoreApiSession();
          if (!initialized.ok) return initialized;
          return execute(false);
        }
        return { ok: false, status: response.status, error: message };
      }

      return { ok: true, data: payload as T };
    } catch (error) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : "Store API request failed" };
    }
  };

  if (!isStateChanging) {
    await mutationQueue;
    return execute();
  }

  const queuedRequest = mutationQueue.then(
    () => execute(),
    () => execute(),
  );
  mutationQueue = queuedRequest.then(
    () => undefined,
    () => undefined,
  );
  return queuedRequest;
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
  /** Some Store API extensions add explicit parent/variation IDs, but core uses `id`
   * for the purchasable product or variation. */
  product_id?: number;
  variation_id?: number;
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
export async function getCart(): Promise<StoreApiResponse<StoreApiCart>> {
  const hadCartToken = Boolean(getStoredCartToken());
  const result = await storeApiRequest<StoreApiCart>("cart");
  if (
    !result.ok &&
    hadCartToken &&
    (result.status === 400 || result.status === 401 || result.status === 403)
  ) {
    resetStoreApiSession();
    return storeApiRequest<StoreApiCart>("cart");
  }
  return result;
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
  customer_password?: string;
  subscribe_to_newsletter?: boolean;
  extensions?: Record<string, Record<string, string | boolean>>;
};

export type StoreApiCheckoutResult = {
  order_id: number;
  customer_id?: number;
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

export type StoreApiOrderItem = {
  id: number;
  quantity: number;
  name: string;
  variation?: Array<{ attribute: string; value: string }>;
  item_data?: Array<{ key: string; value: string }>;
  totals: {
    line_subtotal: string;
    line_subtotal_tax: string;
    line_total: string;
    line_total_tax: string;
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
    currency_decimal_separator: string;
    currency_thousand_separator: string;
    currency_prefix: string;
    currency_suffix: string;
  };
};

export type StoreApiOrder = {
  id: number;
  status: string;
  items: StoreApiOrderItem[];
  coupons: Array<{
    code: string;
    totals?: {
      total_discount?: string;
      total_discount_tax?: string;
    };
  }>;
  totals: StoreApiCartTotals & {
    subtotal: string;
    total_discount: string;
    total_shipping: string | null;
    total_fees: string;
    total_tax: string;
    total_refund: string;
    total_items: string;
  };
  shipping_address: StoreApiAddress;
  billing_address: StoreApiAddress;
  needs_payment: boolean;
  needs_shipping: boolean;
};

/** Submits the WooCommerce Store API checkout — this is the real, standard REST call
 * the WooCommerce Stripe Gateway plugin (and its BLIK sub-method, `stripe_blik`) hook
 * into on the backend, replacing the legacy prototype's raw-secret-key Netlify
 * function. On success, `payment_result.payment_details` carries whatever the active
 * gateway needs client-side to finish confirmation (e.g. a Stripe `client_secret`). */
export function submitStoreCheckout(
  payload: StoreApiCheckoutPayload,
  options?: { requireAuthenticatedUser?: boolean },
): Promise<StoreApiResponse<StoreApiCheckoutResult>> {
  return storeApiRequest<StoreApiCheckoutResult>("checkout", {
    method: "POST",
    body: payload,
    requireAuthenticatedUser: options?.requireAuthenticatedUser,
  });
}

/** Retrieves a completed guest order using the authorization values returned by
 * checkout. Registered-customer orders may require the authenticated account API. */
export function getOrder(
  orderId: number,
  orderKey: string,
  billingEmail: string,
): Promise<StoreApiResponse<StoreApiOrder>> {
  const query = new URLSearchParams({
    key: orderKey,
    billing_email: billingEmail,
  });
  return storeApiRequest<StoreApiOrder>(`order/${orderId}?${query.toString()}`);
}

export type StoreApiShippingMethod = {
  /** Canonical WooCommerce Store API rate identifier. */
  rate_id?: string;
  /** Compatibility fields returned by some Store API extensions. */
  id?: string;
  rate?: string;
  name: string;
  description?: string;
  delivery_time?: string;
  price: string;
  taxes?: string;
  choice_disabled?: boolean;
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
  /** Canonical nested rate collection returned by WooCommerce core. */
  shipping_rates?: StoreApiShippingMethod[];
  /** Compatibility collection returned by older/custom Store API implementations. */
  shipping_methods?: StoreApiShippingMethod[];
};

/** Syncs the current cart customer addresses, allowing WooCommerce to recalculate
 * shipping/tax/payment availability for the active anonymous cart session. */
export function updateCartCustomer(
  billingAddress: StoreApiAddress,
  shippingAddress: StoreApiAddress = billingAddress,
): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/update-customer", {
    method: "POST",
    body: {
      billing_address: billingAddress,
      shipping_address: shippingAddress,
    },
  });
}

/** Fetches available shipping methods for the current cart after syncing the address. */
export async function getShippingMethods(
  billingAddress: StoreApiAddress,
  shippingAddress: StoreApiAddress = billingAddress,
): Promise<StoreApiResponse<StoreApiShippingOption[]>> {
  const updated = await updateCartCustomer(billingAddress, shippingAddress);
  if (!updated.ok) return updated;
  return { ok: true, data: updated.data.shipping_rates ?? [] };
}

/** Selects a specific shipping method for the cart. */
export function selectShippingMethod(method: { package_id: number; rate_id: string }): Promise<StoreApiResponse<StoreApiCart>> {
  return storeApiRequest<StoreApiCart>("cart/select-shipping-rate", { method: "POST", body: method });
}

export type StoreApiCouponResponse = StoreApiCart;

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
export async function calculateTaxes(
  billingAddress: StoreApiAddress,
  shippingAddress: StoreApiAddress = billingAddress,
): Promise<StoreApiResponse<StoreApiTaxResult>> {
  const updated = await updateCartCustomer(billingAddress, shippingAddress);
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
