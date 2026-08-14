import type { StoreApiCheckoutResult } from "./wcStoreApi";

export type BlikReconciliationResponse = {
  payment_status?: string;
  intent_status?: string;
  order_status?: string;
  message?: string;
};

export function buildBlikReconciliationRequest(
  backendOrigin: string,
  order: Pick<StoreApiCheckoutResult, "order_id" | "order_key">,
  billingEmail: string,
): { url: string; body: Record<string, string> } {
  const url = new URL(`${backendOrigin}/index.php`);
  url.searchParams.set(
    "rest_route",
    `/funkycommerce/v1/orders/${order.order_id}/reconcile-blik`,
  );
  return {
    url: url.toString(),
    body: {
      key: order.order_key || "",
      email: billingEmail.trim(),
    },
  };
}

export function blikReconciliationOutcome(
  response: BlikReconciliationResponse,
): "success" | "processing" | "pending" | "failure" {
  if (
    response.payment_status === "success"
    || ["processing", "completed"].includes(response.order_status || "")
  ) {
    return "success";
  }
  if (
    response.payment_status === "processing"
    || response.intent_status === "processing"
    || response.order_status === "on-hold"
  ) {
    return "processing";
  }
  if (
    response.payment_status === "failure"
    || ["canceled", "requires_payment_method"].includes(response.intent_status || "")
    || ["failed", "cancelled"].includes(response.order_status || "")
  ) {
    return "failure";
  }
  return "pending";
}
