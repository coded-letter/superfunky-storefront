import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

let publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export function setStripePublishableKey(key: string | null | undefined): void {
  if (key && key.startsWith("pk_")) {
    if (publishableKey !== key) {
      publishableKey = key;
      stripePromise = null;
    }
    return;
  }
  if (!publishableKey) {
    publishableKey = undefined;
  }
}

export function getStripePublishableKey(): string | null {
  return publishableKey && publishableKey.startsWith("pk_") ? publishableKey : null;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripePublishableKey());
}

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily loads Stripe.js exactly once, only when a publishable key is configured. */
export function getStripe(): Promise<Stripe | null> | null {
  const key = getStripePublishableKey();
  if (!key) return null;
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

/** Best-effort currency-symbol → ISO currency code mapping for Stripe's `amount`/
 * `currency` Elements options — the storefront only ever renders one of a handful of
 * currency symbols, so this shortlist is enough for mockup-grade accuracy. */
export function currencyCodeFromSymbol(symbol: string): string {
  switch (symbol) {
    case "$":
      return "usd";
    case "£":
      return "gbp";
    case "zł":
      return "pln";
    case "€":
    default:
      return "eur";
  }
}
