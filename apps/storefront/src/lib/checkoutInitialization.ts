import type { StoreApiAddress, StoreApiCart } from "./wcStoreApi.ts";

export function checkoutCartMatchesShippingAddress(
  cart: StoreApiCart,
  shippingAddress: StoreApiAddress,
): boolean {
  if (cart.needs_shipping === false) return false;
  if (cart.has_calculated_shipping !== true) return false;
  const destination = cart.shipping_rates?.[0]?.destination;
  if (!destination) return false;

  const requestedDestination = {
    address_1: shippingAddress.address_1,
    address_2: shippingAddress.address_2 ?? "",
    city: shippingAddress.city,
    state: shippingAddress.state ?? "",
    postcode: shippingAddress.postcode,
    country: shippingAddress.country,
  };
  return Object.entries(requestedDestination).every(([field, value]) => {
    const requested = value.trim().toUpperCase();
    if (!requested) return true;
    return String(destination[field as keyof typeof destination] ?? "").trim().toUpperCase() === requested;
  });
}
