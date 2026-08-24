import type { CheckoutBillingDetails, CheckoutSubmissionOptions } from "./payments";
import type { StoreApiAddress, StoreApiCheckoutPayload } from "./wcStoreApi";

export const CHECKOUT_CONTEXT_NAMESPACE = "funkycommerce/checkout";

export type CheckoutContextInput = {
  language: string;
  backendLanguage: string;
  currency?: string;
  accountUsername?: string;
  marketingConsent?: boolean;
  marketingConsentLabel?: string;
  captureKey?: string;
  entryUrl?: string;
  referrer?: string;
  userAgent?: string;
  sessionStartTime?: string;
};

function trimmed(value: string | undefined, maxLength: number): string {
  return (value || "").trim().slice(0, maxLength);
}

function normalizeLanguage(value: string | undefined, fallback: string, maxLength = 20): string {
  const candidate = trimmed(value, maxLength).toLowerCase();
  return /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(candidate) ? candidate : fallback.toLowerCase();
}

function normalizeCaptureKey(value: string | undefined): string {
  const candidate = trimmed(value, 80);
  return /^[A-Za-z0-9_-]{20,80}$/.test(candidate) ? candidate : "";
}

export function buildCheckoutExtensions(
  context: CheckoutContextInput,
): Record<string, Record<string, string | boolean>> {
  return {
    [CHECKOUT_CONTEXT_NAMESPACE]: {
      language: normalizeLanguage(context.language, context.backendLanguage),
      backend_language: trimmed(context.backendLanguage, 40),
      currency: trimmed(context.currency, 3).toUpperCase(),
      account_username: trimmed(context.accountUsername, 60),
      marketing_consent: context.marketingConsent === true,
      marketing_consent_label: trimmed(context.marketingConsentLabel, 250),
      ...(normalizeCaptureKey(context.captureKey) ? { capture_key: normalizeCaptureKey(context.captureKey) } : {}),
      session_entry: trimmed(context.entryUrl, 500),
      referrer: trimmed(context.referrer, 500),
      user_agent: trimmed(context.userAgent, 500),
      session_start_time: trimmed(context.sessionStartTime, 40),
    },
  };
}

function toStoreApiAddress(details: CheckoutBillingDetails): StoreApiAddress {
  return {
    first_name: details.firstName,
    last_name: details.lastName,
    company: details.company,
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

const DIGITAL_ADDRESS_FALLBACK = {
  addressLine1: "Digital delivery",
  city: "Digital order",
  postcode: "00000",
} as const;

export function withDigitalCheckoutAddress(
  details: CheckoutBillingDetails,
): CheckoutBillingDetails {
  return {
    ...details,
    addressLine1: details.addressLine1.trim() || DIGITAL_ADDRESS_FALLBACK.addressLine1,
    city: details.city.trim() || DIGITAL_ADDRESS_FALLBACK.city,
    postcode: details.postcode.trim() || DIGITAL_ADDRESS_FALLBACK.postcode,
  };
}

export function withDigitalStoreApiAddress(address: StoreApiAddress): StoreApiAddress {
  return {
    ...address,
    address_1: address.address_1.trim() || DIGITAL_ADDRESS_FALLBACK.addressLine1,
    city: address.city.trim() || DIGITAL_ADDRESS_FALLBACK.city,
    postcode: address.postcode.trim() || DIGITAL_ADDRESS_FALLBACK.postcode,
  };
}

export function buildStoreCheckoutPayload(
  billing: CheckoutBillingDetails,
  paymentMethod: StoreApiCheckoutPayload["payment_method"],
  options?: CheckoutSubmissionOptions,
  stripePaymentData?: StoreApiCheckoutPayload["payment_data"],
): StoreApiCheckoutPayload {
  const billingAddress = toStoreApiAddress(
    options?.digitalOrder ? withDigitalCheckoutAddress(billing) : billing,
  );
  return {
    billing_address: billingAddress,
    shipping_address: options?.shippingAddress
      ? toStoreApiAddress(options.shippingAddress)
      : billingAddress,
    payment_method: paymentMethod,
    create_account: options?.createAccount,
    customer_password: options?.createAccount ? options.customerPassword : undefined,
    subscribe_to_newsletter: options?.subscribeToNewsletter,
    customer_note: options?.customerNote?.trim() || undefined,
    extensions: buildCheckoutExtensions({
      language: options?.language || "en",
      backendLanguage: options?.backendLanguage || options?.language || "en",
      currency: options?.selectedCurrency,
      accountUsername: options?.createAccount ? options.accountUsername : undefined,
      marketingConsent: options?.subscribeToNewsletter,
      marketingConsentLabel: options?.marketingConsentLabel,
      captureKey: options?.captureKey,
      entryUrl: typeof window !== "undefined" ? window.location.href : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      sessionStartTime: new Date().toISOString(),
    }),
    payment_data:
      stripePaymentData ??
      (paymentMethod === "funkycommerce_crypto" && options?.cryptoAssetCode
        ? [{ key: "funkycommerce_crypto_asset", value: options.cryptoAssetCode.toUpperCase() }]
        : undefined),
  };
}
