import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCart, useLanguage, type CartLineItem } from "@funky/ui";
import { authStore } from "./auth.ts";
import { mergeCartLineItemsByMaxQuantity } from "@funky/ui";
import { isBackendConfigured, restUrl } from "@funky/sdk";
import {
  ABANDONED_CART_CONFIG,
  ABANDONED_CART_ENDPOINT,
  type AbandonedCartPublicConfig,
  type AbandonedCartPublicConfigSource,
  isAbandonedCartBackendConfigured,
  isAbandonedCartFeatureAvailable,
  normalizeAbandonedCartPublicConfig,
  stripAbandonedCartRecoveryParams,
  type AbandonedCartSource,
} from "./abandonedCartConfig.ts";
import { getCart, type StoreApiCartItem } from "./wcStoreApi.ts";
import { suspendCartSync, syncCartToBackend } from "./backendCart.ts";

type CapturedCartItem = {
  lineId: string;
  productId: number;
  variationId: number;
  variationAttributes: Record<string, string>;
  name: string;
  variantLabel: string;
  priceAmount: number;
  quantity: number;
};

export type AbandonedCartPayload = {
  capture_key: string;
  email: string;
  cart: CapturedCartItem[];
  cart_total: number;
  item_count: number;
  currency: string;
  source: AbandonedCartSource | string;
  consent: true;
  user_id?: number;
  timestamp?: string;
  user_agent?: string;
  url?: string;
};

export type AbandonedCartCaptureResult =
  | { ok: true; id: number; captureKey: string; status: string }
  | { ok: false; error: string };

type TrackingSnapshot = {
  cart: CartLineItem[];
  email: string | null;
  consent: boolean;
  currency: string;
  completed: boolean;
};

export type AbandonedCartRecoveryIssue = {
  name: string;
  reason: string;
  quantity: number;
};

export type AbandonedCartRecoveryResponse = {
  status: string;
  mode: string;
  language: string;
  locale: string;
  restored: boolean;
  unavailableCount: number;
  unavailableItems?: AbandonedCartRecoveryIssue[];
  cartUrl?: string;
  redirectUrl?: string;
};

type AbandonedCartRecoveryFetchResult =
  | { ok: true; recovery: AbandonedCartRecoveryResponse }
  | { ok: false; error: string };

export type AbandonedCartRecoveryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message?: string }
  | { status: "partial"; message: string; unavailableItems: AbandonedCartRecoveryIssue[] }
  | { status: "error"; message: string };

export function saveNewsletterEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("funkycommerce-newsletter-email", email.trim());
  } catch {
    // Newsletter persistence is optional.
  }
}

export function saveCheckoutEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ABANDONED_CART_CONFIG.STORAGE_KEYS.checkout,
      JSON.stringify({ email: email.trim() }),
    );
  } catch {
    // Checkout remains usable when browser storage is unavailable.
  }
}

function createStableCaptureKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-")}`;
}

export function getEmailFromMultipleSources(): string | null {
  if (typeof window === "undefined") return null;

  const auth = authStore.load();
  if (auth?.user?.email) return auth.user.email;

  try {
    const value = window.localStorage.getItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.checkout);
    const stored = value ? (JSON.parse(value) as { email?: string }) : null;
    return stored?.email?.trim() || null;
  } catch {
    return null;
  }
}

export function calculateCartTotals(cart: CartLineItem[]): { cartTotal: number; itemCount: number } {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => {
    const amount = item.priceAmount
      ?? Number.parseFloat(item.priceLabel.replace(/[^0-9.,-]/g, "").replace(",", "."));
    return sum + (Number.isFinite(amount) ? amount : 0) * item.quantity;
  }, 0);

  return { cartTotal: Number(cartTotal.toFixed(6)), itemCount };
}

export function isCartAbandonmentReady(
  cart: CartLineItem[],
  email: string | null,
  consent = false,
): boolean {
  if (!consent || !email) return false;
  if (
    email.length < ABANDONED_CART_CONFIG.VALIDATION.MIN_EMAIL_LENGTH
    || email.length > ABANDONED_CART_CONFIG.VALIDATION.MAX_EMAIL_LENGTH
  ) {
    return false;
  }
  return cart.reduce((sum, item) => sum + item.quantity, 0)
    >= ABANDONED_CART_CONFIG.VALIDATION.MIN_CART_ITEMS;
}

export function getOrCreateCaptureKey(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.captureKey);
    if (existing) return existing;

    const key = createStableCaptureKey();
    window.localStorage.setItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.captureKey, key);
    return key;
  } catch {
    return null;
  }
}

export function clearAbandonedCartCapture(): void {
  if (typeof window === "undefined") return;
  lastSubmissionAt = 0;
  try {
    window.localStorage.removeItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.captureKey);
  } catch {
    // WooCommerce order recovery remains authoritative.
  }
}

function serializeCart(items: CartLineItem[]): CapturedCartItem[] {
  return items.map((item) => ({
    lineId: item.id,
    productId: item.backendProductId || 0,
    variationId: item.backendVariationId || 0,
    variationAttributes: item.variationAttributes || {},
    name: item.name,
    variantLabel: item.variantLabel || "",
    priceAmount: item.priceAmount || 0,
    quantity: item.quantity,
  }));
}

const publicConfigCache = new Map<string, AbandonedCartPublicConfig | null>();
const publicConfigInFlight = new Map<string, Promise<AbandonedCartPublicConfig | null>>();

function publicConfigCacheKey(languageCode: string, backendLanguageCode: string): string {
  return `${languageCode.toLowerCase()}|${backendLanguageCode.toLowerCase()}`;
}

async function fetchAbandonedCartPublicConfig(
  languageCode: string,
  backendLanguageCode: string,
  configuredLanguageCodes: readonly string[] = [],
): Promise<AbandonedCartPublicConfig | null> {
  const endpoint = restUrl("funkycommerce/v1/abandoned-carts/config");
  if (!endpoint || !isBackendConfigured) return null;

  const key = publicConfigCacheKey(languageCode, backendLanguageCode);
  const cached = publicConfigCache.get(key);
  if (cached) return cached;
  if (publicConfigInFlight.has(key)) return publicConfigInFlight.get(key)!;

  const url = new URL(endpoint);
  url.searchParams.set("language", languageCode);
  url.searchParams.set("locale", backendLanguageCode);

  const request = fetch(url.toString(), { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return null;
      const raw = (await response.json().catch(() => null)) as AbandonedCartPublicConfigSource | null;
      const normalized = normalizeAbandonedCartPublicConfig(raw, {
        languageCode,
        locale: backendLanguageCode,
        configuredLanguageCodes,
      });
      publicConfigCache.set(key, normalized);
      return normalized;
    })
    .catch(() => null)
    .finally(() => {
      publicConfigInFlight.delete(key);
    });

  publicConfigInFlight.set(key, request);
  return request;
}

export function useAbandonedCartPublicConfig(): {
  config: AbandonedCartPublicConfig | null;
  loaded: boolean;
} {
  const { languageCode, languageBackendCode, configuredLanguageCodes } = useLanguage();
  const [state, setState] = useState<{ config: AbandonedCartPublicConfig | null; loaded: boolean }>({
    config: null,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (!isBackendConfigured) {
      setState({ config: null, loaded: true });
      return () => {
        cancelled = true;
      };
    }

    void fetchAbandonedCartPublicConfig(languageCode, languageBackendCode, configuredLanguageCodes).then((config) => {
      if (!cancelled) setState({ config, loaded: true });
    });

    return () => {
      cancelled = true;
    };
  }, [configuredLanguageCodes, languageBackendCode, languageCode]);

  return state;
}

function toCartLineItem(item: StoreApiCartItem): CartLineItem {
  const backendProductId = item.product_id ?? item.id;
  const backendVariationId = item.variation_id && item.variation_id > 0 ? item.variation_id : undefined;
  const priceAmount = Number.parseFloat(item.price);
  return {
    id: backendVariationId ? `${backendProductId}-${backendVariationId}` : String(backendProductId),
    backendProductId,
    backendVariationId,
    name: item.name,
    priceLabel: item.price,
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : undefined,
    quantity: item.quantity,
    imageUrl: item.images?.[0]?.src || undefined,
  };
}

let lastSubmissionAt = 0;

export async function sendAbandonedCart({
  email,
  cart,
  source,
  consent,
  currency,
  keepalive = false,
  debounceMs,
}: {
  email: string;
  cart: CartLineItem[];
  source: AbandonedCartSource | string;
  consent: boolean;
  currency: string;
  keepalive?: boolean;
  debounceMs?: number;
}): Promise<AbandonedCartCaptureResult> {
  if (!isAbandonedCartBackendConfigured || !ABANDONED_CART_ENDPOINT) {
    return { ok: false, error: "Abandoned-cart backend is not configured." };
  }
  if (!isCartAbandonmentReady(cart, email, consent)) {
    return { ok: false, error: "Cart, email, and privacy consent are required." };
  }

  const captureKey = getOrCreateCaptureKey();
  if (!captureKey) return { ok: false, error: "Cart capture storage is unavailable." };

  const now = Date.now();
  const resolvedDebounceMs = Math.max(0, debounceMs ?? ABANDONED_CART_CONFIG.SUBMISSION_DEBOUNCE_MS);
  if (now - lastSubmissionAt < resolvedDebounceMs) return { ok: false, error: "Cart capture was debounced." };

  const { cartTotal, itemCount } = calculateCartTotals(cart);
  const auth = authStore.load();
  const payload: AbandonedCartPayload = {
    capture_key: captureKey,
    email,
    cart: serializeCart(cart),
    cart_total: cartTotal,
    item_count: itemCount,
    currency,
    source,
    consent: true,
    ...(auth?.user?.databaseId ? { user_id: auth.user.databaseId } : {}),
    ...(ABANDONED_CART_CONFIG.INCLUDE_METADATA.TIMESTAMP ? { timestamp: new Date().toISOString() } : {}),
    ...(ABANDONED_CART_CONFIG.INCLUDE_METADATA.USER_AGENT && typeof navigator !== "undefined"
      ? { user_agent: navigator.userAgent }
      : {}),
    ...(ABANDONED_CART_CONFIG.INCLUDE_METADATA.URL && typeof window !== "undefined"
      ? { url: window.location.href }
      : {}),
  };

  try {
    const response = await fetch(ABANDONED_CART_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    });
    const body = (await response.json().catch(() => null)) as {
      id?: number;
      captureKey?: string;
      status?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      return { ok: false, error: body?.message || `Cart capture failed (${response.status}).` };
    }
    if (!body?.id || !body.captureKey || !body.status) {
      return { ok: false, error: "Cart capture returned an invalid response." };
    }

    lastSubmissionAt = now;
    return { ok: true, id: body.id, captureKey: body.captureKey, status: body.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cart capture request failed.",
    };
  }
}

async function recoverAbandonedCart(
  token: string,
  languageCode: string,
  backendLanguageCode: string,
  mode?: string,
): Promise<AbandonedCartRecoveryFetchResult> {
  const endpoint = restUrl(`funkycommerce/v1/abandoned-carts/${encodeURIComponent(token)}/recover`);
  if (!endpoint || !isBackendConfigured) return { ok: false, error: "Abandoned-cart recovery backend is not configured." };

  const url = new URL(endpoint);
  if (mode) url.searchParams.set("mode", mode);
  url.searchParams.set("language", languageCode);
  url.searchParams.set("locale", backendLanguageCode);

  try {
    const response = await fetch(url.toString(), { method: "GET", cache: "no-store", redirect: "manual" });
    const body = (await response.json().catch(() => null)) as AbandonedCartRecoveryResponse | null;
    if ((response.status === 200 || response.status === 303) && body) {
      return { ok: true, recovery: body };
    }
    return { ok: false, error: `Cart recovery failed (${response.status}).` };
  } catch {
    return { ok: false, error: "Cart recovery request failed." };
  }
}

export function useAbandonedCartRecovery(): AbandonedCartRecoveryState {
  const { languageCode, languageBackendCode } = useLanguage();
  const { mergeItems, items } = useCart();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<AbandonedCartRecoveryState>({ status: "idle" });
  const handledTokenRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const mergeItemsRef = useRef(mergeItems);
  itemsRef.current = items;
  mergeItemsRef.current = mergeItems;

  useEffect(() => {
    const token = searchParams.get("funkycommerce_recovery")?.trim();
    if (!token || handledTokenRef.current === token) return;
    handledTokenRef.current = token;

    let cancelled = false;
    let released = false;
    setState({ status: "loading" });

    const cleanedSearch = stripAbandonedCartRecoveryParams(searchParams);
    const releaseSync = suspendCartSync();
    const releaseOnce = () => {
      if (released) return;
      released = true;
      releaseSync();
    };

    void (async () => {
      try {
        const recoveryResult = await recoverAbandonedCart(token, languageCode, languageBackendCode, searchParams.get("mode") || "headless");
        if (!recoveryResult.ok) {
          if (!cancelled) setState({ status: "error", message: recoveryResult.error });
          return null;
        }
        const recovery = recoveryResult.recovery;

        const restoredCart = await getCart();
        if (!restoredCart.ok) {
          if (!cancelled) setState({ status: "error", message: restoredCart.error });
          return null;
        }

        const recoveredItems = (restoredCart.data.items ?? []).map(toCartLineItem);
        const mergedItems = mergeCartLineItemsByMaxQuantity(itemsRef.current, recoveredItems);
        mergeItemsRef.current(recoveredItems);

        const syncResult = await syncCartToBackend(mergedItems, {
          force: true,
          verifyForCheckout: false,
          ignoreSuspension: true,
        });
        const partialIssues = recovery.unavailableItems ?? [];
        const partialCount = recovery.unavailableCount || partialIssues.length;
        const partialMessage =
          partialCount > 0
            ? `${partialCount} recovered cart item${partialCount === 1 ? "" : "s"} could not be restored.`
            : "";

        if (!cancelled) {
          if (!syncResult.ok) {
            setState({ status: "error", message: syncResult.error });
          } else if (partialCount > 0) {
            setState({ status: "partial", message: partialMessage, unavailableItems: partialIssues });
          } else {
            setState({ status: "success", message: "Saved cart restored." });
          }
        }
        return recovery;
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Cart recovery failed.",
          });
        }
        return null;
      } finally {
        releaseOnce();
        if (!cancelled) {
          navigate(
            {
              pathname: location.pathname,
              search: cleanedSearch.toString() ? `?${cleanedSearch.toString()}` : "",
              hash: location.hash,
            },
            { replace: true },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      releaseOnce();
    };
  }, [
    languageBackendCode,
    languageCode,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    searchParams,
  ]);

  return state;
}

function setupIdleTracker(
  getSnapshot: () => TrackingSnapshot,
  idleMs = ABANDONED_CART_CONFIG.IDLE_TIME_MS,
  debounceMs = ABANDONED_CART_CONFIG.SUBMISSION_DEBOUNCE_MS,
): () => void {
  if (typeof window === "undefined" || idleMs <= 0) {
    return () => undefined;
  }

  let timer: number | null = null;
  const resetTimer = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const snapshot = getSnapshot();
      if (!snapshot.email || snapshot.completed) return;
      void sendAbandonedCart({
        email: snapshot.email,
        cart: snapshot.cart,
        source: ABANDONED_CART_CONFIG.SOURCES.CHECKOUT_IDLE,
        consent: snapshot.consent,
        currency: snapshot.currency,
        debounceMs,
      }).then((result) => {
        if (!result.ok && result.error !== "Cart capture was debounced.") {
          console.warn("[abandoned-cart]", result.error);
        }
      });
    }, idleMs);
  };

  resetTimer();
  ABANDONED_CART_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    ABANDONED_CART_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, resetTimer);
    });
  };
}

function setupPageExitTracker(
  getSnapshot: () => TrackingSnapshot,
  debounceMs = ABANDONED_CART_CONFIG.SUBMISSION_DEBOUNCE_MS,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => {
    const snapshot = getSnapshot();
    if (!snapshot.email || snapshot.completed) return;
    void sendAbandonedCart({
      email: snapshot.email,
      cart: snapshot.cart,
      source: ABANDONED_CART_CONFIG.SOURCES.PAGE_UNLOAD_BEACON,
      consent: snapshot.consent,
      currency: snapshot.currency,
      keepalive: true,
      debounceMs,
    });
  };

  window.addEventListener("pagehide", handler);
  return () => window.removeEventListener("pagehide", handler);
}

export function useAbandonedCartTracking(
  billingEmail?: string,
  consent = false,
  currency = "",
): { completeCapture: () => void } {
  const { items } = useCart();
  const { languageCode, languageBackendCode } = useLanguage();
  const { config: publicConfig } = useAbandonedCartPublicConfig();
  const trackingConsent = publicConfig?.checkout.mode === "legitimate_interest" ? true : consent;
  const idleMs = publicConfig?.checkout.idleMs ?? ABANDONED_CART_CONFIG.IDLE_TIME_MS;
  const debounceMs = publicConfig?.checkout.debounceMs ?? ABANDONED_CART_CONFIG.SUBMISSION_DEBOUNCE_MS;
  const stateRef = useRef<TrackingSnapshot>({
    cart: items,
    email: billingEmail ?? null,
    consent: trackingConsent,
    currency,
    completed: false,
  });
  stateRef.current = {
    ...stateRef.current,
    cart: items,
    email: billingEmail || getEmailFromMultipleSources(),
    consent: trackingConsent,
    currency,
  };

  useEffect(() => {
    if (items.length === 0) clearAbandonedCartCapture();
  }, [items.length]);

  useEffect(() => {
    if (!isAbandonedCartBackendConfigured || !isAbandonedCartFeatureAvailable(publicConfig)) {
      return undefined;
    }
    const stopIdle = setupIdleTracker(() => stateRef.current, idleMs, debounceMs);
    const stopPageExit = setupPageExitTracker(() => stateRef.current, debounceMs);
    return () => {
      stopIdle();
      stopPageExit();
    };
  }, [debounceMs, idleMs, languageBackendCode, languageCode, publicConfig]);

  return {
    completeCapture: () => {
      stateRef.current.completed = true;
      clearAbandonedCartCapture();
    },
  };
}
