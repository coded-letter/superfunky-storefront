import { normalizeBackendError } from "@funky/ui";
import { BACKEND_ORIGIN } from "@funky/sdk";
import type { StoreApiCheckoutResult } from "./wcStoreApi";
import { buildCheckoutOrderClaimRequest } from "./checkoutAccountRequest";

export async function claimCheckoutOrder(
  order: StoreApiCheckoutResult,
  billingEmail: string,
  authToken: string,
): Promise<number> {
  if (!BACKEND_ORIGIN || !order.order_key) {
    throw new Error("The store did not return the credentials needed to link this order.");
  }

  const request = buildCheckoutOrderClaimRequest(BACKEND_ORIGIN, order, billingEmail);
  const response = await fetch(request.url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-WPGraphQL-Login-Token": authToken,
    },
    body: JSON.stringify(request.body),
  });
  const payload = (await response.json().catch(() => null)) as { customer_id?: number; message?: string } | null;
  if (!response.ok || !payload?.customer_id) {
    throw new Error(
      payload?.message
        ? normalizeBackendError(payload.message)
        : `Order linking failed with status ${response.status}.`,
    );
  }
  return payload.customer_id;
}
