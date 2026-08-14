type CheckoutOrderClaim = {
  order_id: number;
  order_key?: string;
};

export function buildCheckoutOrderClaimRequest(
  backendOrigin: string,
  order: CheckoutOrderClaim,
  billingEmail: string,
): { url: string; body: Record<string, string> } {
  const url = new URL(`${backendOrigin}/index.php`);
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
