/** Real backend-wired payment logic — gateway availability (from WPGraphQL) and
 * checkout submission (via the WooCommerce Store API's `checkout` route, which is what
 * the WooCommerce Stripe Gateway plugin and its BLIK sub-method actually hook into on
 * the backend). This replaces the legacy prototype's Netlify-function approach, which
 * held the raw Stripe *secret* key in a serverless function — that key never belongs
 * in this repo at all; it's configured once in wp-admin → WooCommerce → Settings →
 * Payments → Stripe, and the Store API checkout call below is how the frontend talks
 * to that already-configured gateway without ever touching the secret key. */

import { useEffect, useState } from "react";
import { getOrCreateCaptureKey } from "./abandonedCart";
import {
  buildStoreCheckoutPayload,
  withDigitalCheckoutAddress,
} from "./checkoutContext";
import { BACKEND_ORIGIN, graphqlRequest, isBackendConfigured } from "@funky/sdk";
import { getStripe } from "./stripe";
import {
  type CryptoAsset,
  type PaymentGatewayCacheSeed,
  type PaymentGatewayNode,
  parsePaymentGatewayCacheSeed,
  restorePaymentGatewayCache,
} from "./paymentGatewayCache";
import {
  buildStripePaymentData,
  buildStripeOrderStatusRequest,
  parseStripeConfirmationRedirect,
  stripeOrderStatusError,
  type StripeOrderStatusResponse,
  toStripeBillingDetails,
} from "./stripePaymentData";
import {
  submitStoreCheckout,
  type StoreApiCheckoutResult,
} from "./wcStoreApi";
import {
  blikReconciliationOutcome,
  buildBlikReconciliationRequest,
  type BlikReconciliationResponse,
} from "./blikPayment";

export { isStripeConfigured, getStripe, currencyCodeFromSymbol } from "./stripe.ts";
export { buildStripePaymentData, toStripeBillingDetails } from "./stripePaymentData.ts";

const PAYMENT_GATEWAYS_QUERY = /* GraphQL */ `
  query StorefrontPaymentGateways {
    paymentGateways {
      nodes {
        id
        title
        description
      }
    }
    funkycommerceStorefrontConfig {
      cryptoAssets {
        code
        label
        network
        wallet
        fiatRate
        qrUrl
      }
    }
  }
`;

export type { CryptoAsset } from "./paymentGatewayCache";
type PaymentGatewaysResult = {
  paymentGateways: { nodes: PaymentGatewayNode[] } | null;
  funkycommerceStorefrontConfig: {
    cryptoAssets: CryptoAsset[];
  } | null;
};

type PaymentGatewaySnapshot = {
  ids: Set<string>;
  gateways: Map<string, PaymentGatewayNode>;
  cryptoAssets: CryptoAsset[];
};

type PersistedPaymentGatewayCache = PaymentGatewayCacheSeed & {
  cachedAt: number;
};

const PAYMENT_GATEWAY_CACHE_KEY = "storefront:payment-gateways:v1";
const PAYMENT_GATEWAY_FRESH_MS = 10 * 60 * 1_000;

function snapshotFromSeed(seed: PaymentGatewayCacheSeed): PaymentGatewaySnapshot {
  return {
    ids: new Set(seed.gateways.map(({ id }) => id)),
    gateways: new Map(seed.gateways.map((gateway) => [gateway.id, gateway])),
    cryptoAssets: seed.cryptoAssets,
  };
}

function readPrerenderedGatewaySnapshot(): PaymentGatewaySnapshot | null {
  if (typeof document === "undefined") return null;
  const serialized = document.getElementById("storefront-payment-gateway-cache")?.textContent;
  if (!serialized) return null;
  try {
    const seed = parsePaymentGatewayCacheSeed(JSON.parse(serialized));
    if (!seed) {
      console.warn("Prerendered payment-gateway cache was rejected because it is malformed.");
      return null;
    }
    return snapshotFromSeed(seed);
  } catch (error) {
    console.warn("Prerendered payment-gateway cache could not be restored.", error);
    return null;
  }
}

function readPersistedGatewaySnapshot(): { snapshot: PaymentGatewaySnapshot; cachedAt: number } | null {
  if (typeof localStorage === "undefined") return null;
  const discardPersistedCache = () => {
    try {
      localStorage.removeItem(PAYMENT_GATEWAY_CACHE_KEY);
    } catch (error) {
      console.warn("Invalid payment-gateway cache could not be removed.", error);
    }
  };
  try {
    const serialized = localStorage.getItem(PAYMENT_GATEWAY_CACHE_KEY);
    const restored = restorePaymentGatewayCache(serialized);
    if (!restored) {
      if (serialized) discardPersistedCache();
      return null;
    }
    return {
      snapshot: snapshotFromSeed(restored.seed),
      cachedAt: restored.cachedAt,
    };
  } catch (error) {
    discardPersistedCache();
    console.warn("Payment-gateway cache could not be restored.", error);
    return null;
  }
}

function persistGatewaySnapshot(snapshot: PaymentGatewaySnapshot, cachedAt: number) {
  if (typeof localStorage === "undefined") return;
  const payload: PersistedPaymentGatewayCache = {
    cachedAt,
    gateways: Array.from(snapshot.gateways.values()),
    cryptoAssets: snapshot.cryptoAssets,
  };
  try {
    localStorage.setItem(PAYMENT_GATEWAY_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Payment-gateway cache could not be persisted.", error);
  }
}

const persistedGatewayCache = readPersistedGatewaySnapshot();
let cachedGatewaySnapshot = persistedGatewayCache?.snapshot || readPrerenderedGatewaySnapshot();
let cachedGatewayAt = persistedGatewayCache?.cachedAt || 0;
let inFlight: Promise<PaymentGatewaySnapshot> | null = null;

function fetchEnabledGatewaySnapshot(): Promise<PaymentGatewaySnapshot> {
  if (cachedGatewaySnapshot && Date.now() - cachedGatewayAt < PAYMENT_GATEWAY_FRESH_MS) {
    return Promise.resolve(cachedGatewaySnapshot);
  }
  if (inFlight) return inFlight;

  inFlight = graphqlRequest<PaymentGatewaysResult>(PAYMENT_GATEWAYS_QUERY).then(({ data, errors }) => {
    if (errors?.length) {
      throw new Error(errors.map(({ message }) => message).join("; "));
    }
    if (!data?.paymentGateways) {
      throw new Error("The payment-gateway query returned no gateway data.");
    }
    const gatewayNodes = data?.paymentGateways?.nodes ?? [];
    const snapshot = {
      ids: new Set(gatewayNodes.map((node) => node.id)),
      gateways: new Map(gatewayNodes.map((node) => [node.id, node])),
      cryptoAssets: data?.funkycommerceStorefrontConfig?.cryptoAssets ?? [],
    };
    cachedGatewaySnapshot = snapshot;
    cachedGatewayAt = Date.now();
    persistGatewaySnapshot(snapshot, cachedGatewayAt);
    return snapshot;
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export type PaymentGatewayAvailability = {
  /** True once the backend confirms its `stripe` WooCommerce gateway is enabled — the
   * Payment Element only submits for real once this is true (otherwise the checkout
   * page shows its existing "not connected" fallback). */
  isStripeGatewayEnabled: boolean;
  /** True if WooCommerce exposes its distinct `stripe_blik` gateway (PLN only). */
  isBlikAvailable: boolean;
  /** True if FunkyCommerce Crypto Wallet is enabled on the backend and has assets configured. */
  isCryptoAvailable: boolean;
  cryptoGatewayTitle: string;
  cryptoGatewayDescription: string;
  cryptoAssets: CryptoAsset[];
  /** True if Cash on Delivery is enabled. */
  isCodAvailable: boolean;
  /** True if Direct Bank Transfer (BACS) is enabled. */
  isBacsAvailable: boolean;
  /** True if Check/Cheque payments are enabled. */
  isCheckAvailable: boolean;
  loaded: boolean;
};

function paymentGatewayAvailability(
  snapshot: PaymentGatewaySnapshot | null,
  currencyCode?: string,
): PaymentGatewayAvailability {
  const cryptoAssets = (snapshot?.cryptoAssets ?? []).filter(
    (asset) => typeof asset.fiatRate === "number" && asset.fiatRate > 0,
  );
  return {
    isStripeGatewayEnabled: snapshot?.ids.has("stripe") ?? false,
    isBlikAvailable: currencyCode === "PLN" && (snapshot?.ids.has("stripe_blik") ?? false),
    isCryptoAvailable:
      (snapshot?.ids.has("funkycommerce_crypto") ?? false) &&
      cryptoAssets.length > 0,
    cryptoGatewayTitle: snapshot?.gateways.get("funkycommerce_crypto")?.title || "Superfunky Crypto Wallet",
    cryptoGatewayDescription:
      snapshot?.gateways.get("funkycommerce_crypto")?.description ||
      "Pay directly with one of the configured store wallets.",
    cryptoAssets,
    isCodAvailable: snapshot?.ids.has("cod") ?? false,
    isBacsAvailable: snapshot?.ids.has("bacs") ?? false,
    isCheckAvailable: snapshot?.ids.has("cheque") ?? false,
    loaded: Boolean(snapshot),
  };
}

export function getCachedPaymentGatewayAvailability(currencyCode?: string): PaymentGatewayAvailability {
  return paymentGatewayAvailability(cachedGatewaySnapshot, currencyCode);
}

/** Live payment-gateway availability, sourced from WPGraphQL's `paymentGateways` query
 * (public, confirmed working on the live backend — lists whichever gateways are
 * actually enabled in wp-admin, so this never drifts out of sync with the real store
 * configuration). Resolves to "not enabled" immediately when no backend is configured.
 * BLIK is a distinct Woo Stripe gateway and must never be inferred from PLN + card Stripe:
 * its plugin/account/currency availability is represented by the `stripe_blik` node.
 * For Crypto, checks the real gateway plus whether at least one wallet asset is configured. */
export function usePaymentGateways(currencyCode?: string): PaymentGatewayAvailability {
  const [state, setState] = useState<PaymentGatewayAvailability>(() =>
    getCachedPaymentGatewayAvailability(currencyCode));

  useEffect(() => {
    if (!isBackendConfigured) return;
    let cancelled = false;
    void fetchEnabledGatewaySnapshot().then((snapshot) => {
      if (!cancelled) {
        setState(paymentGatewayAvailability(snapshot, currencyCode));
      }
    }).catch((error) => {
      console.error("Payment-gateway configuration could not be refreshed.", error);
    });
    return () => {
      cancelled = true;
    };
  }, [currencyCode]);

  return state;
}

export type CheckoutBillingDetails = {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postcode: string;
  /** ISO 3166-1 alpha-2 country code — the Store API rejects anything else. */
  countryCode: string;
  email: string;
  phone: string;
};

export type PaymentSubmissionResult =
  | { ok: true; order: StoreApiCheckoutResult }
  | { ok: false; error: string; order?: StoreApiCheckoutResult };

export type CheckoutSubmissionOptions = {
  createAccount?: boolean;
  accountUsername?: string;
  customerPassword?: string;
  subscribeToNewsletter?: boolean;
  marketingConsentLabel?: string;
  requireAuthenticatedUser?: boolean;
  language?: string;
  backendLanguage?: string;
  captureKey?: string;
  customerNote?: string;
  shippingAddress?: CheckoutBillingDetails;
  digitalOrder?: boolean;
  cryptoAssetCode?: string;
  stripePaymentMethodId?: string;
  stripePaymentType?: string;
  blikCode?: string;
};

function paymentDetailsMap(order: StoreApiCheckoutResult): Map<string, string> {
  return new Map((order.payment_result.payment_details ?? []).map(({ key, value }) => [key, value]));
}

function paymentFailureMessage(order: StoreApiCheckoutResult): string {
  const details = paymentDetailsMap(order);
  return (
    details.get("errorMessage") ||
    details.get("error_message") ||
    details.get("message") ||
    "The store could not process this payment."
  );
}

/** Creates the BLIK PaymentMethod before Woo checkout. Woo then creates the order
 * with billing details before attempting payment, so a gateway failure remains visible
 * to merchants as a failed/pending order. */
export async function createBlikPaymentMethod(
  billing: CheckoutBillingDetails,
): Promise<{ ok: true; paymentMethodId: string } | { ok: false; error: string }> {
  const stripePromise = getStripe();
  if (!stripePromise) return { ok: false, error: "Stripe is not configured." };
  const stripe = await stripePromise;
  if (!stripe) return { ok: false, error: "Stripe could not be loaded." };

  const result = await stripe.createPaymentMethod({
    type: "blik",
    blik: {},
    billing_details: toStripeBillingDetails(billing),
  });
  if (result.error) {
    return { ok: false, error: result.error.message || "Could not prepare the BLIK payment." };
  }
  return { ok: true, paymentMethodId: result.paymentMethod.id };
}

/** Completes SCA/redirect-capable Stripe intents encoded by the Woo Stripe plugin in
 * its standard `#wc-stripe-confirm-pi|si:order:client_secret:nonce` redirect fragment.
 * Woo webhooks remain the source of truth for the final order status. */
export async function completeStripePayment(
  order: StoreApiCheckoutResult,
): Promise<PaymentSubmissionResult> {
  if (order.payment_result.payment_status === "failure" || order.payment_result.payment_status === "error") {
    return { ok: false, error: paymentFailureMessage(order), order };
  }

  const redirectUrl = order.payment_result.redirect_url || paymentDetailsMap(order).get("redirect") || "";
  const confirmation = parseStripeConfirmationRedirect(redirectUrl);
  if (!confirmation) {
    return order.payment_result.payment_status === "pending"
      ? {
          ok: false,
          error: "The store did not return the Stripe confirmation details needed to finish this payment.",
          order,
        }
      : { ok: true, order };
  }
  if (!order.order_key) {
    return {
      ok: false,
      error: "The store did not return the order key needed to securely finish this payment.",
      order,
    };
  }

  const stripePromise = getStripe();
  if (!stripePromise) return { ok: false, error: "Stripe is not configured.", order };
  const stripe = await stripePromise;
  if (!stripe) return { ok: false, error: "Stripe could not be loaded.", order };

  const result = confirmation.intentType === "si"
    ? await stripe.confirmSetup({ clientSecret: confirmation.clientSecret, redirect: "if_required" })
    : await stripe.confirmPayment({ clientSecret: confirmation.clientSecret, redirect: "if_required" });
  const intentId =
    ("paymentIntent" in result ? result.paymentIntent?.id : result.setupIntent?.id) ||
    confirmation.clientSecret.split("_secret_", 1)[0];

  if (!intentId || !BACKEND_ORIGIN) {
    return {
      ok: false,
      error: result.error?.message || "Stripe did not return the payment intent needed to finish the order.",
      order,
    };
  }

  const verificationRequest = buildStripeOrderStatusRequest(
    BACKEND_ORIGIN,
    confirmation,
    intentId,
    order.order_key,
  );
  let verification: StripeOrderStatusResponse;
  try {
    const response = await fetch(verificationRequest.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: verificationRequest.body,
    });
    verification = (await response.json().catch(() => null)) as StripeOrderStatusResponse | null ?? {};
    if (!response.ok) {
      return {
        ok: false,
        error: result.error?.message || `WooCommerce payment reconciliation failed with status ${response.status}.`,
        order,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error:
        result.error?.message ||
        (error instanceof Error ? error.message : "Store payment reconciliation failed."),
      order,
    };
  }

  const verificationError = stripeOrderStatusError(verification);
  if (result.error || verificationError) {
    return {
      ok: false,
      error: result.error?.message || verificationError || "Stripe could not confirm the payment.",
      order,
    };
  }

  return {
    ok: true,
    order: {
      ...order,
      payment_result: {
        ...order.payment_result,
        payment_status: "success",
        redirect_url: verification.data?.return_url || confirmation.returnUrl,
      },
    },
  };
}

const BLIK_RECONCILIATION_TIMEOUT_MS = 90_000;
const BLIK_RECONCILIATION_INTERVAL_MS = 2_000;

/** Polls the backend after the customer submits a BLIK code. Woo Stripe normally
 * finalizes BLIK asynchronously via webhook; this verifies the live intent with Stripe
 * and invokes the gateway's own webhook handler when delivery is delayed. */
export async function completeBlikPayment(
  order: StoreApiCheckoutResult,
  billingEmail: string,
): Promise<PaymentSubmissionResult> {
  if (!BACKEND_ORIGIN || !order.order_key) {
    return {
      ok: false,
      error: "The store did not return the credentials needed to verify the BLIK payment.",
      order,
    };
  }

  const request = buildBlikReconciliationRequest(BACKEND_ORIGIN, order, billingEmail);
  const deadline = Date.now() + BLIK_RECONCILIATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let response: Response;
    let payload: BlikReconciliationResponse | null;
    try {
      response = await fetch(request.url, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      payload = (await response.json().catch(() => null)) as BlikReconciliationResponse | null;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The BLIK payment status could not be verified.",
        order,
      };
    }

    if (response.status === 409) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, BLIK_RECONCILIATION_INTERVAL_MS));
      continue;
    }
    if (!response.ok || !payload) {
      return {
        ok: false,
        error: payload?.message || `BLIK payment verification failed with status ${response.status}.`,
        order,
      };
    }

    const outcome = blikReconciliationOutcome(payload);
    if (outcome === "success" || outcome === "processing") {
      return {
        ok: true,
        order: {
          ...order,
          status: payload.order_status || order.status,
          payment_result: {
            ...order.payment_result,
            payment_status: outcome === "success" ? "success" : "pending",
          },
        },
      };
    }
    if (outcome === "failure") {
      return {
        ok: false,
        error: payload.message || "The BLIK payment was declined or canceled.",
        order: {
          ...order,
          status: payload.order_status || order.status,
          payment_result: { ...order.payment_result, payment_status: "failure" },
        },
      };
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, BLIK_RECONCILIATION_INTERVAL_MS));
  }

  return {
    ok: false,
    error: "BLIK approval was not confirmed in time. Check your banking app before retrying the payment.",
    order,
  };
}

/** Submits checkout with customer account creation and optional newsletter subscription. */
export async function submitCheckoutWithAccount(
  billing: CheckoutBillingDetails,
  paymentMethod: "stripe" | "stripe_blik" | "cod" | "cheque" | "bacs" | "funkycommerce_crypto",
  options?: CheckoutSubmissionOptions,
): Promise<PaymentSubmissionResult> {
  const paymentBilling = options?.digitalOrder
    ? withDigitalCheckoutAddress(billing)
    : billing;
  const stripePaymentData =
    (paymentMethod === "stripe" || paymentMethod === "stripe_blik") &&
    options?.stripePaymentMethodId
      ? buildStripePaymentData(paymentBilling, options.stripePaymentMethodId, {
          gatewayId: paymentMethod,
          blikCode: paymentMethod === "stripe_blik" ? options.blikCode : undefined,
          selectedPaymentType: options.stripePaymentType,
        })
      : undefined;

  if ((paymentMethod === "stripe" || paymentMethod === "stripe_blik") && !stripePaymentData) {
    return { ok: false, error: "Stripe payment details are missing. Please re-enter them and try again." };
  }

  const result = await submitStoreCheckout(
    buildStoreCheckoutPayload(
      paymentBilling,
      paymentMethod,
      { ...options, captureKey: getOrCreateCaptureKey() || undefined },
      stripePaymentData,
    ),
    { requireAuthenticatedUser: options?.requireAuthenticatedUser },
  );
  if (!result.ok) return { ok: false, error: result.error };
  if (
    result.data.payment_result.payment_status === "failure" ||
    result.data.payment_result.payment_status === "error"
  ) {
    return { ok: false, error: paymentFailureMessage(result.data), order: result.data };
  }
  return { ok: true, order: result.data };
}
