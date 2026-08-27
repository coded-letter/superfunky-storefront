export type StripeBillingInput = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postcode: string;
  countryCode: string;
  email: string;
  phone: string;
};

export function toStripeBillingDetails(details: StripeBillingInput) {
  const address = {
    ...(details.addressLine1.trim() ? { line1: details.addressLine1.trim() } : {}),
    ...(details.addressLine2?.trim() ? { line2: details.addressLine2.trim() } : {}),
    ...(details.city.trim() ? { city: details.city.trim() } : {}),
    ...(details.state?.trim() ? { state: details.state.trim() } : {}),
    ...(details.postcode.trim() ? { postal_code: details.postcode.trim() } : {}),
    country: details.countryCode,
  };
  return {
    name: `${details.firstName} ${details.lastName}`.trim(),
    email: details.email,
    phone: details.phone || null,
    address,
  };
}

export function buildStripePaymentData(
  billing: StripeBillingInput,
  paymentMethodId: string,
  options?: {
    gatewayId?: "stripe" | "stripe_blik";
    blikCode?: string;
    selectedPaymentType?: string;
    selectedCurrency?: string;
  },
): Array<{ key: string; value: string }> {
  const data = [
    { key: "payment_method", value: options?.gatewayId || "stripe" },
    { key: "wc-stripe-payment-method", value: paymentMethodId },
    { key: "wc_payment_intent_id", value: "" },
    { key: "save_payment_method", value: "no" },
    { key: "billing_email", value: billing.email },
    { key: "billing_first_name", value: billing.firstName },
    { key: "billing_last_name", value: billing.lastName },
    { key: "billing_address_1", value: billing.addressLine1 },
    { key: "billing_address_2", value: billing.addressLine2 || "" },
    { key: "billing_city", value: billing.city },
    { key: "billing_state", value: billing.state || "" },
    { key: "billing_postcode", value: billing.postcode },
    { key: "billing_country", value: billing.countryCode },
    { key: "billing_phone", value: billing.phone },
  ];
  if (options?.selectedPaymentType) {
    data.push({
      key: "wc_stripe_selected_upe_payment_type",
      value: options.selectedPaymentType,
    });
  }
  if (options?.selectedCurrency) {
    data.push({
      key: "funkycommerce_selected_currency",
      value: options.selectedCurrency.trim().toUpperCase(),
    });
  }
  if (options?.blikCode) {
    data.push({ key: "wc-stripe-blik-code", value: options.blikCode });
  }
  return data;
}

export type StripeConfirmationRedirect = {
  intentType: "pi" | "si";
  orderId: string;
  clientSecret: string;
  nonce: string;
  returnUrl: string;
};

export type StripeOrderStatusResponse = {
  success?: boolean;
  data?: {
    return_url?: string;
    error?: string | { message?: string };
  };
};

export function parseStripeConfirmationRedirect(
  redirectUrl: string,
): StripeConfirmationRedirect | null {
  const match = redirectUrl.match(
    /#wc-stripe-confirm-(pi|si):([^:]+):([^:]+):([^:]+)$/,
  );
  if (!match) return null;
  return {
    intentType: match[1] as "pi" | "si",
    orderId: match[2],
    clientSecret: match[3],
    nonce: match[4],
    returnUrl: redirectUrl.split("#", 1)[0],
  };
}

export function buildStripeOrderStatusRequest(
  backendOrigin: string,
  confirmation: StripeConfirmationRedirect,
  intentId: string,
  orderKey: string,
  paymentMethodId?: string,
): { url: string; body: URLSearchParams } {
  const url = new URL(backendOrigin);
  url.searchParams.set("wc-ajax", "wc_stripe_update_order_status");

  const body = new URLSearchParams({
    order_id: confirmation.orderId,
    order_key: orderKey,
    intent_id: intentId,
    _ajax_nonce: confirmation.nonce,
  });
  if (paymentMethodId) body.set("payment_method_id", paymentMethodId);

  return { url: url.toString(), body };
}

export function stripeOrderStatusError(response: StripeOrderStatusResponse): string | null {
  if (response.success) return null;
  const error = response.data?.error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error.message === "string" && error.message) return error.message;
  return "The store could not reconcile the confirmed Stripe payment.";
}
