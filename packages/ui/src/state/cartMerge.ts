import type { CartLineItem } from "./CartContext.tsx";

export type MergeCartItemInput = Omit<CartLineItem, "quantity"> & { quantity?: number };

export function mergeCartLineItemsByMaxQuantity(
  currentItems: CartLineItem[],
  incomingItems: MergeCartItemInput[],
): CartLineItem[] {
  const merged = new Map<string, CartLineItem>(currentItems.map((item) => [item.id, { ...item }]));

  for (const incoming of incomingItems) {
    const quantity = Math.max(1, Math.trunc(incoming.quantity ?? 1));
    const existing = merged.get(incoming.id);
    if (existing) {
      merged.set(incoming.id, {
        ...existing,
        ...incoming,
        quantity: Math.max(existing.quantity, quantity),
      });
      continue;
    }

    merged.set(incoming.id, {
      ...incoming,
      quantity,
    });
  }

  return Array.from(merged.values());
}
