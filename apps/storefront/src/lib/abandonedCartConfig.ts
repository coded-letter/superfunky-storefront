/** Premium companion configuration derived from the configured WordPress origin. */

import { restUrl } from "./env";

export const ABANDONED_CART_ENDPOINT = restUrl("funkycommerce/v1/abandoned-carts");

export const isAbandonedCartBackendConfigured = Boolean(ABANDONED_CART_ENDPOINT);

export const ABANDONED_CART_CONFIG = {
  /** Idle time (ms) of no mouse/keyboard/touch/scroll activity before auto-submitting
   * on the checkout page. Set to 0 to disable idle tracking entirely. */
  IDLE_TIME_MS: 30_000,

  ACTIVITY_EVENTS: ["mousedown", "keydown", "scroll", "touchstart"] as const,

  /** Debounce window (ms) preventing duplicate submissions in quick succession. */
  SUBMISSION_DEBOUNCE_MS: 2_000,

  // Fallback symbol only — real shop currency now comes from the live WooCommerce
  // Store API (see `lib/currency.ts`); this is just what abandoned-cart total parsing
  // falls back to before that first live fetch resolves.
  CURRENCY_SYMBOL: "€",

  STORAGE_KEYS: {
    checkout: "funkycommerce-checkout-form",
    captureKey: "funkycommerce-abandoned-cart-capture-key",
  },

  SOURCES: {
    CHECKOUT_IDLE: "checkout_idle",
    CHECKOUT_FORM_CHANGE: "checkout_form_change",
    PAGE_UNLOAD_BEACON: "page_unload_beacon",
    MANUAL_TRIGGER: "manual_trigger",
  } as const,

  VALIDATION: {
    MIN_CART_ITEMS: 1,
    MIN_EMAIL_LENGTH: 5,
    MAX_EMAIL_LENGTH: 254,
  },

  INCLUDE_METADATA: {
    USER_AGENT: true,
    TIMESTAMP: true,
    URL: true,
  },
} as const;

export type AbandonedCartSource = (typeof ABANDONED_CART_CONFIG.SOURCES)[keyof typeof ABANDONED_CART_CONFIG.SOURCES];
