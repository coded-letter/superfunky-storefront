import { useEffect, useRef } from "react";
import { useCart, type CartLineItem } from "@funky/ui";
import { authStore } from "./auth";
import {
  ABANDONED_CART_CONFIG,
  ABANDONED_CART_ENDPOINT,
  isAbandonedCartBackendConfigured,
  type AbandonedCartSource,
} from "./abandonedCartConfig";

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

function getOrCreateCaptureKey(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.captureKey);
    if (existing) return existing;

    const key = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-")}`;
    window.localStorage.setItem(ABANDONED_CART_CONFIG.STORAGE_KEYS.captureKey, key);
    return key;
  } catch {
    return null;
  }
}

export function clearAbandonedCartCapture(): void {
  if (typeof window === "undefined") return;
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

let lastSubmissionAt = 0;

export async function sendAbandonedCart({
  email,
  cart,
  source,
  consent,
  currency,
  keepalive = false,
}: {
  email: string;
  cart: CartLineItem[];
  source: AbandonedCartSource | string;
  consent: boolean;
  currency: string;
  keepalive?: boolean;
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
  if (now - lastSubmissionAt < ABANDONED_CART_CONFIG.SUBMISSION_DEBOUNCE_MS) {
    return { ok: false, error: "Cart capture was debounced." };
  }
  lastSubmissionAt = now;

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

    return { ok: true, id: body.id, captureKey: body.captureKey, status: body.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cart capture request failed.",
    };
  }
}

function setupIdleTracker(getSnapshot: () => TrackingSnapshot): () => void {
  if (typeof window === "undefined" || ABANDONED_CART_CONFIG.IDLE_TIME_MS <= 0) {
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
      }).then((result) => {
        if (!result.ok && result.error !== "Cart capture was debounced.") {
          console.warn("[abandoned-cart]", result.error);
        }
      });
    }, ABANDONED_CART_CONFIG.IDLE_TIME_MS);
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

function setupPageExitTracker(getSnapshot: () => TrackingSnapshot): () => void {
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
  const stateRef = useRef<TrackingSnapshot>({
    cart: items,
    email: billingEmail ?? null,
    consent,
    currency,
    completed: false,
  });
  stateRef.current = {
    ...stateRef.current,
    cart: items,
    email: billingEmail || getEmailFromMultipleSources(),
    consent,
    currency,
  };

  useEffect(() => {
    if (items.length === 0) clearAbandonedCartCapture();
  }, [items.length]);

  useEffect(() => {
    if (!isAbandonedCartBackendConfigured) return undefined;
    const stopIdle = setupIdleTracker(() => stateRef.current);
    const stopPageExit = setupPageExitTracker(() => stateRef.current);
    return () => {
      stopIdle();
      stopPageExit();
    };
  }, []);

  return {
    completeCapture: () => {
      stateRef.current.completed = true;
      clearAbandonedCartCapture();
    },
  };
}
