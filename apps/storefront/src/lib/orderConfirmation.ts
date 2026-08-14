import type { CartLineItem } from "@funky/ui";
import type { StoreApiCheckoutResult } from "./wcStoreApi";

const STORAGE_KEY = "funkycommerce-order-confirmation-v1";
export const ORDER_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

export type CapturedOrderItem = {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  total: string;
};

export type CapturedOrderTotals = {
  subtotal: string;
  discount?: string;
  shipping?: string;
  tax?: string;
  total: string;
};

export type OrderConfirmation = {
  version: 1;
  capturedAt: string;
  mode: "physical" | "digital";
  order: StoreApiCheckoutResult;
  billingEmail: string;
  currency?: string;
  accountLoginError?: string;
  items: CapturedOrderItem[];
  totals: CapturedOrderTotals;
  coupons: string[];
  shippingMethod?: string;
};

type CreateOrderConfirmationInput = {
  mode: OrderConfirmation["mode"];
  order: StoreApiCheckoutResult;
  billingEmail: string;
  currency: string;
  accountLoginError?: string;
  items: CartLineItem[];
  formatAmount: (amount: number) => string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupons: string[];
  shippingMethod?: string;
};

export function createOrderConfirmation(input: CreateOrderConfirmationInput): OrderConfirmation {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    mode: input.mode,
    order: input.order,
    billingEmail: input.billingEmail,
    currency: input.currency.trim().toUpperCase(),
    accountLoginError: input.accountLoginError,
    items: input.items.map((item) => ({
      id: item.id,
      name: item.name,
      variant: item.variantLabel || "",
      quantity: item.quantity,
      total: input.formatAmount((item.priceAmount || 0) * item.quantity),
    })),
    totals: {
      subtotal: input.formatAmount(input.subtotal),
      ...(input.discount > 0 ? { discount: `-${input.formatAmount(input.discount)}` } : {}),
      shipping: input.mode === "digital" ? "Digital delivery" : input.shipping === 0 ? "Free" : input.formatAmount(input.shipping),
      tax: input.formatAmount(input.tax),
      total: input.formatAmount(input.total),
    },
    coupons: [...input.coupons],
    shippingMethod: input.shippingMethod,
  };
}

export function saveOrderConfirmation(confirmation: OrderConfirmation): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(confirmation));
  } catch (error) {
    console.warn(
      "[orderConfirmation] Could not persist the completed order for a page refresh:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function loadOrderConfirmation(orderId?: number, now = Date.now()): OrderConfirmation | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null") as unknown;
    if (!isOrderConfirmation(parsed, now)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return orderId === undefined || parsed.order.order_id === orderId ? parsed : null;
  } catch (error) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    console.warn(
      "[orderConfirmation] Could not read the completed order:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function orderConfirmationFromNavigationState(
  state: unknown,
  orderId?: number,
  now = Date.now(),
): OrderConfirmation | null {
  if (!state || typeof state !== "object") return null;
  const candidate = "confirmation" in state ? (state as { confirmation?: unknown }).confirmation : null;
  if (!isOrderConfirmation(candidate, now)) return null;
  return orderId === undefined || candidate.order.order_id === orderId ? candidate : null;
}

function isOrderConfirmation(value: unknown, now: number): value is OrderConfirmation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OrderConfirmation>;
  const capturedAt = Date.parse(candidate.capturedAt || "");
  return candidate.version === 1
    && Number.isFinite(capturedAt)
    && capturedAt <= now
    && now - capturedAt < ORDER_CONFIRMATION_TTL_MS
    && (candidate.mode === "physical" || candidate.mode === "digital")
    && Boolean(candidate.billingEmail)
    && Boolean(candidate.order)
    && typeof candidate.order?.order_id === "number"
    && Boolean(candidate.order?.order_key)
    && Array.isArray(candidate.items)
    && Boolean(candidate.totals)
    && typeof candidate.totals?.total === "string"
    && Array.isArray(candidate.coupons);
}
