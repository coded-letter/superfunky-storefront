import { backendItemMatches } from "./cartIdentity.ts";
import type { StoreApiCart, StoreApiCartItem } from "./wcStoreApi.ts";

export type ResolvedCartLine = {
  productId: number;
  variationId: number | null;
  variationAttributes?: Record<string, string>;
  quantity: number;
};

export type CartReconciliationPlan = {
  remove: StoreApiCartItem[];
  update: Array<{ item: StoreApiCartItem; quantity: number }>;
  add: ResolvedCartLine[];
};

/** Plans the smallest set of Store API mutations needed to match the frontend cart
 * without replacing the cart session (which would discard coupons and shipping). */
export function planCartReconciliation(
  cart: StoreApiCart,
  desiredLines: ResolvedCartLine[],
): CartReconciliationPlan {
  const unmatchedItems = new Map((cart.items ?? []).map((item) => [item.key, item]));
  const update: CartReconciliationPlan["update"] = [];
  const add: ResolvedCartLine[] = [];

  for (const line of desiredLines) {
    const match = Array.from(unmatchedItems.values()).find((item) =>
      backendItemMatches(item, line.productId, line.variationId),
    );
    if (!match) {
      add.push(line);
      continue;
    }
    unmatchedItems.delete(match.key);
    if (match.quantity !== line.quantity) {
      update.push({ item: match, quantity: line.quantity });
    }
  }

  return {
    remove: Array.from(unmatchedItems.values()),
    update,
    add,
  };
}
