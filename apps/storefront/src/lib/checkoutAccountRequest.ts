type CheckoutOrderClaim = {
  order_id: number;
  order_key?: string;
};

export function buildCheckoutOrderClaimRequest(
  backendBaseUrl: string,
  order: CheckoutOrderClaim,
  billingEmail: string,
): { url: string; body: Record<string, string> } {
  const url = new URL("index.php", backendBaseUrl);
  url.searchParams.set(
    "rest_route",
    `/funkycommerce/v1/orders/${order.order_id}/claim-customer`,
  );
  return {
    url: url.toString(),
    body: {
      key: order.order_key || "",
      email: billingEmail.trim(),
    },
  };
}
