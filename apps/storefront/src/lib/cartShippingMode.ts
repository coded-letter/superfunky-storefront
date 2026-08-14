import type { StoreApiCart } from "./wcStoreApi";

export function isCartVirtual(cartItems: Array<{ virtual?: boolean }>): boolean {
  return cartItems.length > 0 && cartItems.every((item) => item.virtual === true);
}

/** Prefer WooCommerce's cart-wide calculation so mixed and physical downloadable carts
 * retain shipping. Local product flags are only a fallback before backend hydration. */
export function isDigitalOnlyCart(
  backendCart: Pick<StoreApiCart, "items" | "needs_shipping"> | null | undefined,
  localItems: Array<{ virtual?: boolean }>,
): boolean {
  if ((backendCart?.items?.length ?? 0) > 0 && typeof backendCart?.needs_shipping === "boolean") {
    return backendCart.needs_shipping === false;
  }
  return isCartVirtual(localItems);
}
