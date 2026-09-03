import type { StoreApiCart } from "./wcStoreApi";

export function isCheckoutPaymentMethodAvailable(
  cart: StoreApiCart | null,
  methodId: string,
  configuredFallback: boolean,
): boolean {
  return Array.isArray(cart?.payment_methods)
    ? cart.payment_methods.includes(methodId)
    : configuredFallback;
}
