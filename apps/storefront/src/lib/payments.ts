/** Real backend-wired payment logic — gateway availability (from WPGraphQL) and
 * checkout submission (via the WooCommerce Store API's `checkout` route, which is what
 * the WooCommerce Stripe Gateway plugin and its BLIK sub-method actually hook into on
 * the backend). This replaces the legacy prototype's Netlify-function approach, which
 * held the raw Stripe *secret* key in a serverless function — that key never belongs
 * in this repo at all; it's configured once in wp-admin → WooCommerce → Settings →
 * Payments → Stripe, and the Store API checkout call below is how the frontend talks
 * to that already-configured gateway without ever touching the secret key. */

import { useEffect, useState } from "react";
import { isBackendConfigured } from "./env";
import { graphqlRequest } from "./graphqlClient";
import { submitStoreCheckout, type StoreApiAddress, type StoreApiCheckoutResult } from "./wcStoreApi";

export { isStripeConfigured, getStripe, currencyCodeFromSymbol } from "./stripe";

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

type PaymentGatewayNode = { id: string; title: string; description?: string | null };
export type CryptoAsset = {
  code: string;
  label: string;
  network: string;
  wallet: string;
  fiatRate: number;
  qrUrl?: string | null;
};
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

let cachedGatewaySnapshot: PaymentGatewaySnapshot | null = null;
let inFlight: Promise<PaymentGatewaySnapshot> | null = null;

function fetchEnabledGatewaySnapshot(): Promise<PaymentGatewaySnapshot> {
  if (cachedGatewaySnapshot) return Promise.resolve(cachedGatewaySnapshot);
  if (inFlight) return inFlight;

  inFlight = graphqlRequest<PaymentGatewaysResult>(PAYMENT_GATEWAYS_QUERY).then(({ data }) => {
    const gatewayNodes = data?.paymentGateways?.nodes ?? [];
    const snapshot = {
      ids: new Set(gatewayNodes.map((node) => node.id)),
      gateways: new Map(gatewayNodes.map((node) => [node.id, node])),
      cryptoAssets: data?.funkycommerceStorefrontConfig?.cryptoAssets ?? [],
    };
    cachedGatewaySnapshot = snapshot;
    return snapshot;
  });
  return inFlight;
}

export type PaymentGatewayAvailability = {
  /** True once the backend confirms its `stripe` WooCommerce gateway is enabled — the
   * Payment Element only submits for real once this is true (otherwise the checkout
   * page shows its existing "not connected" fallback). */
  isStripeGatewayEnabled: boolean;
  /** True if BLIK is available through Stripe (PLN only). */
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

/** Live payment-gateway availability, sourced from WPGraphQL's `paymentGateways` query
 * (public, confirmed working on the live backend — lists whichever gateways are
 * actually enabled in wp-admin, so this never drifts out of sync with the real store
 * configuration). Resolves to "not enabled" immediately when no backend is configured. 
 * For BLIK, WooCommerce Stripe exposes it under the main `stripe` gateway rather than a
 * separate `stripe_blik` payment-gateway node on this backend, so PLN + Stripe-enabled is
 * the correct availability rule here.
 * For Crypto, checks the real gateway plus whether at least one wallet asset is configured. */
export function usePaymentGateways(currencyCode?: string): PaymentGatewayAvailability {
  const [state, setState] = useState<PaymentGatewayAvailability>({
    isStripeGatewayEnabled: cachedGatewaySnapshot?.ids.has("stripe") ?? false,
    isBlikAvailable: currencyCode === "PLN" && (cachedGatewaySnapshot?.ids.has("stripe") ?? false),
    isCryptoAvailable:
      (cachedGatewaySnapshot?.ids.has("funkycommerce_crypto") ?? false) &&
      (cachedGatewaySnapshot?.cryptoAssets.length ?? 0) > 0,
    cryptoGatewayTitle: cachedGatewaySnapshot?.gateways.get("funkycommerce_crypto")?.title || "FunkyCommerce Crypto Wallet",
    cryptoGatewayDescription:
      cachedGatewaySnapshot?.gateways.get("funkycommerce_crypto")?.description ||
      "Pay directly with one of the configured store wallets.",
    cryptoAssets: cachedGatewaySnapshot?.cryptoAssets ?? [],
    isCodAvailable: cachedGatewaySnapshot?.ids.has("cod") ?? false,
    isBacsAvailable: cachedGatewaySnapshot?.ids.has("bacs") ?? false,
    isCheckAvailable: cachedGatewaySnapshot?.ids.has("cheque") ?? false,
    loaded: Boolean(cachedGatewaySnapshot),
  });

  useEffect(() => {
    if (!isBackendConfigured) return;
    let cancelled = false;
    void fetchEnabledGatewaySnapshot().then((snapshot) => {
      if (!cancelled) {
        setState({
          isStripeGatewayEnabled: snapshot.ids.has("stripe"),
          isBlikAvailable: currencyCode === "PLN" && snapshot.ids.has("stripe"),
          isCryptoAvailable:
            snapshot.ids.has("funkycommerce_crypto") &&
            snapshot.cryptoAssets.length > 0,
          cryptoGatewayTitle: snapshot.gateways.get("funkycommerce_crypto")?.title || "FunkyCommerce Crypto Wallet",
          cryptoGatewayDescription:
            snapshot.gateways.get("funkycommerce_crypto")?.description ||
            "Pay directly with one of the configured store wallets.",
          cryptoAssets: snapshot.cryptoAssets,
          isCodAvailable: snapshot.ids.has("cod"),
          isBacsAvailable: snapshot.ids.has("bacs"),
          isCheckAvailable: snapshot.ids.has("cheque"),
          loaded: true,
        });
      }
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

function toStoreApiAddress(details: CheckoutBillingDetails): StoreApiAddress {
  return {
    first_name: details.firstName,
    last_name: details.lastName,
    address_1: details.addressLine1,
    address_2: details.addressLine2,
    city: details.city,
    state: details.state,
    postcode: details.postcode,
    country: details.countryCode,
    email: details.email,
    phone: details.phone,
  };
}

export type PaymentSubmissionResult =
  | { ok: true; order: StoreApiCheckoutResult }
  | { ok: false; error: string };

/** Submits a real WooCommerce Store API checkout for the card/Stripe payment method.
 * The returned `payment_result.payment_details` is where a Stripe `client_secret`
 * would appear for the caller to finish confirming with `stripe.confirmPayment()`. */
export async function submitStripeCheckout(billing: CheckoutBillingDetails): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: "stripe",
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}

/** Same as `submitStripeCheckout`, but for the `stripe_blik` Store API payment method
 * — the WooCommerce Stripe Gateway plugin's BLIK integration, confirmed as its own
 * distinct payment method ID via live schema introspection (not just a Stripe Payment
 * Element option). Pass the 6-digit BLIK code the shopper entered as `payment_data`. */
export async function submitBlikCheckout(billing: CheckoutBillingDetails, blikCode: string): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: "stripe_blik",
    payment_data: [{ key: "blik_code", value: blikCode }],
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}

/** Submits checkout with Cash on Delivery payment method. */
export async function submitCodCheckout(billing: CheckoutBillingDetails): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: "cod",
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}

/** Submits checkout with Check/Cheque payment method. */
export async function submitCheckCheckout(billing: CheckoutBillingDetails): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: "cheque",
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}

/** Submits checkout with WooCommerce's BACS (direct bank transfer) payment method. */
export async function submitBacsCheckout(billing: CheckoutBillingDetails): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: "bacs",
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}

/** Submits checkout with customer account creation and optional newsletter subscription. */
export async function submitCheckoutWithAccount(
  billing: CheckoutBillingDetails,
  paymentMethod: "stripe" | "stripe_blik" | "cod" | "cheque" | "bacs" | "funkycommerce_crypto",
  options?: {
    createAccount?: boolean;
    subscribeToNewsletter?: boolean;
    customerId?: number;
    customerNote?: string;
    blikCode?: string;
    cryptoAssetCode?: string;
  }
): Promise<PaymentSubmissionResult> {
  const result = await submitStoreCheckout({
    billing_address: toStoreApiAddress(billing),
    payment_method: paymentMethod,
    create_account: options?.createAccount,
    subscribe_to_newsletter: options?.subscribeToNewsletter,
    customer_id: options?.customerId,
    customer_note: options?.customerNote,
    payment_data:
      paymentMethod === "stripe_blik" && options?.blikCode
        ? [{ key: "blik_code", value: options.blikCode }]
        : paymentMethod === "funkycommerce_crypto" && options?.cryptoAssetCode
          ? [{ key: "funkycommerce_crypto_asset", value: options.cryptoAssetCode.toUpperCase() }]
          : undefined,
  });
  return result.ok ? { ok: true, order: result.data } : { ok: false, error: result.error };
}
