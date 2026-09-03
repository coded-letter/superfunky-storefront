/** Backend cart synchronization — syncs the frontend CartContext with the
 * live WooCommerce Store API cart. This enables real checkout submission,
 * persistent cart across sessions, and accurate pricing/shipping.
 *
 * Architecture:
 * - CartContext is the frontend source of truth (persisted in localStorage)
 * - Store API cart is the backend source of truth
 * - When available, we sync frontend changes to backend
 * - On checkout, the backend cart is submitted (not frontend-only)
 * - Gracefully falls back to frontend-only when backend is unavailable
 */

import { useEffect, useRef } from "react";
import { mergeCartLineItemsByMaxQuantity, normalizeDisplayLabel, useCart, type CartLineItem } from "@funky/ui";
import { planCartReconciliation, type ResolvedCartLine } from "./cartReconciliation";
import { graphqlRequest, isBackendConfigured } from "@funky/sdk";
import {
  addToCart,
  getCart,
  removeFromCart,
  resetStoreApiSession,
  type StoreApiCart,
  updateCartItem,
} from "./wcStoreApi.ts";

type SyncResult = { ok: true; cart?: StoreApiCart } | { ok: false; error: string };

const PRODUCT_ID_LOOKUP_QUERY = /* GraphQL */ `
  query CheckoutProductIdentity($search: String!) {
    products(first: 20, where: { search: $search }) {
      nodes {
        databaseId
        name
      }
    }
  }
`;

const resolvedProductIds = new Map<string, number>();

async function lookupBackendProductId(
  name: string,
): Promise<{ ok: true; productId: number } | { ok: false; error: string }> {
  const normalizedName = normalizeDisplayLabel(name).trim().toLocaleLowerCase();
  const cached = resolvedProductIds.get(normalizedName);
  if (cached) return { ok: true, productId: cached };

  const { data, errors } = await graphqlRequest<{
    products: { nodes: Array<{ databaseId: number; name: string }> } | null;
  }>(PRODUCT_ID_LOOKUP_QUERY, { search: name });
  if (errors?.length) {
    return {
      ok: false,
      error: `Could not resolve “${name}” in WooCommerce: ${errors.map(({ message }) => message).join("; ")}`,
    };
  }
  const matches = (data?.products?.nodes || []).filter(
    (product) => normalizeDisplayLabel(product.name).trim().toLocaleLowerCase() === normalizedName,
  );
  if (matches.length !== 1 || !Number.isFinite(matches[0].databaseId) || matches[0].databaseId <= 0) {
    return {
      ok: false,
      error: `Could not sync “${name}” to WooCommerce because its backend product ID is missing. Remove it and add the live product from the shop again.`,
    };
  }
  resolvedProductIds.set(normalizedName, matches[0].databaseId);
  return { ok: true, productId: matches[0].databaseId };
}

function decodeLegacyGraphqlId(id: string): number | null {
  try {
    const decoded = atob(id);
    const match = decoded.match(/:(\d+)\s*$/);
    if (!match) return null;
    const numericId = Number.parseInt(match[1], 10);
    return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
  } catch {
    return null;
  }
}

/** Maps a frontend CartLineItem to backend sync identifiers. */
function resolveBackendCartIdentity(lineItem: CartLineItem): {
  productId: number | null;
  variationId: number | null;
  variationAttributes?: Record<string, string>;
} {
  if (Number.isFinite(lineItem.backendProductId) && (lineItem.backendProductId ?? 0) > 0) {
    return {
      productId: lineItem.backendProductId ?? null,
      variationId:
        Number.isFinite(lineItem.backendVariationId) && (lineItem.backendVariationId ?? 0) > 0
          ? lineItem.backendVariationId ?? null
          : null,
      variationAttributes: lineItem.variationAttributes,
    };
  }

  const parts = lineItem.id.split("-");
  const parsedId = Number.parseInt(parts[0] || "", 10);
  const decodedGraphqlId = decodeLegacyGraphqlId(lineItem.id);
  return {
    productId:
      Number.isFinite(parsedId) && parsedId > 0
        ? parsedId
        : decodedGraphqlId,
    variationId:
      Number.isFinite(parsedId) && parsedId > 0
        ? null
        : decodedGraphqlId,
  };
}

let cartSyncQueue: Promise<void> = Promise.resolve();
let syncSuspensionCount = 0;

export function suspendCartSync(): () => void {
  syncSuspensionCount += 1;
  return () => {
    syncSuspensionCount = Math.max(0, syncSuspensionCount - 1);
  };
}

function isCartSyncSuspended(): boolean {
  return syncSuspensionCount > 0;
}

async function performCartSync(
  frontendCart: CartLineItem[],
  verifyForCheckout: boolean,
): Promise<SyncResult> {
  const desiredCart = mergeCartLineItemsByMaxQuantity([], frontendCart);
  const backendResponse = await getCart();
  if (!backendResponse.ok) {
   console.warn("[backendCart] Could not fetch backend cart:", backendResponse.error);
   return { ok: false, error: backendResponse.error };
  }
  let latestCart = backendResponse.data;

  const resolvedLines: ResolvedCartLine[] = [];
  for (const frontendItem of desiredCart) {
   const identity = resolveBackendCartIdentity(frontendItem);
   let { productId } = identity;
   if (!productId) {
     const lookup = await lookupBackendProductId(frontendItem.name);
     if (!lookup.ok) return lookup;
     productId = lookup.productId;
   }
   resolvedLines.push({
     productId,
     variationId: identity.variationId,
     variationAttributes: identity.variationAttributes,
     quantity: frontendItem.quantity,
   });
  }

  const plan = planCartReconciliation(backendResponse.data, resolvedLines);
  for (const change of plan.update) {
   const updated = await updateCartItem({ key: change.item.key, quantity: change.quantity });
   if (!updated.ok) return { ok: false, error: updated.error };
   latestCart = updated.data;
  }
  for (const line of plan.add) {
   const added = await addResolvedCartLine(line);
   if (!added.ok) return added;
   if (added.cart) latestCart = added.cart;
  }
  for (const item of plan.remove) {
   const removed = await removeFromCart(item.key);
   if (!removed.ok) return { ok: false, error: removed.error };
   latestCart = removed.data;
  }

  if (verifyForCheckout || plan.remove.length > 0 || plan.update.length > 0 || plan.add.length > 0) {
   const verifiedCart = await getCart();
   if (!verifiedCart.ok) return { ok: false, error: verifiedCart.error };
   latestCart = verifiedCart.data;
   if (desiredCart.length > 0 && (verifiedCart.data.items?.length ?? 0) === 0) {
     return { ok: false, error: "empty-cart-after-sync" };
   }
   const remainingPlan = planCartReconciliation(verifiedCart.data, resolvedLines);
   if (remainingPlan.remove.length > 0 || remainingPlan.update.length > 0 || remainingPlan.add.length > 0) {
     return { ok: false, error: "cart-mismatch-after-sync" };
   }
  }

  return { ok: true, cart: latestCart };
}

async function addResolvedCartLine(line: ResolvedCartLine): Promise<SyncResult> {
  const added = await addToCart({
    id: line.productId,
    quantity: line.quantity,
    ...(line.variationAttributes && Object.keys(line.variationAttributes).length
      ? { variation: line.variationAttributes }
      : {}),
  });
  if (!added.ok && line.variationId) {
    const variationFallback = await addToCart({ id: line.variationId, quantity: line.quantity });
    if (!variationFallback.ok) return { ok: false, error: variationFallback.error };
    return { ok: true, cart: variationFallback.data };
  } else if (!added.ok) {
    return { ok: false, error: added.error };
  }
  return { ok: true, cart: added.data };
}

/** Synchronizes the frontend cart with the backend. Called after cart mutations
 * (add, remove, update). Gracefully handles backend unavailability. */
export async function syncCartToBackend(
  frontendCart: CartLineItem[],
  options?: { force?: boolean; verifyForCheckout?: boolean; ignoreSuspension?: boolean },
): Promise<SyncResult> {
  if (!isBackendConfigured) return { ok: false, error: "Backend not configured." };
  if (isCartSyncSuspended() && !options?.ignoreSuspension) return { ok: true };

  const queuedSync = cartSyncQueue.then(async (): Promise<SyncResult> => {
    let result = await performCartSync(frontendCart, Boolean(options?.verifyForCheckout));
    if (!result.ok && result.error === "empty-cart-after-sync") {
      resetStoreApiSession();
      result = await performCartSync(frontendCart, true);
    }
    if (!result.ok && result.error === "empty-cart-after-sync") {
      return {
        ok: false,
        error: "The store still reports an empty cart after synchronizing it. Please try again.",
      };
    }
    if (!result.ok && result.error === "cart-mismatch-after-sync") {
      return {
        ok: false,
        error: "The store could not confirm the latest cart quantities. Please try again.",
      };
    }
    return result;
  }).catch((error) => {
    console.warn("[backendCart] Sync error:", error instanceof Error ? error.message : error);
    return { ok: false, error: error instanceof Error ? error.message : "Cart sync failed." };
  });
  cartSyncQueue = queuedSync.then(
    () => undefined,
    () => undefined,
  );
  return queuedSync;
}

/** Hook that syncs the frontend cart to the backend whenever it changes.
 * Call this at the top level of your app to enable persistent backend cart. */
export function useSyncCartToBackend(): void {
  const { items } = useCart();
  const previousItemsRef = useRef<CartLineItem[] | null>(null);

  useEffect(() => {
    if (isCartSyncSuspended()) {
      previousItemsRef.current = items;
      return;
    }
    // Only sync if items actually changed (not just re-renders)
    if (!previousItemsRef.current) {
      previousItemsRef.current = items;
      if (items.length > 0) {
        void syncCartToBackend(items);
      }
      return;
    }

    const previousItems = previousItemsRef.current;
    const itemsChanged =
      items.length !== previousItems.length ||
      items.some(
        (item, i) =>
          !previousItems[i] ||
          previousItems[i].id !== item.id ||
          previousItems[i].quantity !== item.quantity
      );

    if (itemsChanged) {
      previousItemsRef.current = items;
      void syncCartToBackend(items);
    }
  }, [items]);
}
