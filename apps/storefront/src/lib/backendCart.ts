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
import { useCart, type CartLineItem } from "@funky/ui";
import { isBackendConfigured } from "./env";
import { addToCart, getCart, removeFromCart, updateCartItem, type StoreApiCart, type StoreApiCartItem } from "./wcStoreApi";

type SyncResult = { ok: true } | { ok: false; error: string };

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

/** Converts a Store API cart response to a map of backend keys for deduplication. */
function buildBackendKeyMap(cart: StoreApiCart): Map<string, StoreApiCartItem> {
  const keyMap = new Map<string, StoreApiCartItem>();
  if (cart.items) {
    for (const item of cart.items) {
      keyMap.set(item.key, item);
    }
  }
  return keyMap;
}

let syncInProgress = false;
let lastSyncTime = 0;
let activeSyncPromise: Promise<SyncResult> | null = null;
const SYNC_DEBOUNCE_MS = 300; // Debounce rapid changes

/** Synchronizes the frontend cart with the backend. Called after cart mutations
 * (add, remove, update). Gracefully handles backend unavailability. */
export async function syncCartToBackend(
  frontendCart: CartLineItem[],
  options?: { force?: boolean; verifyForCheckout?: boolean },
): Promise<SyncResult> {
  if (!isBackendConfigured) return { ok: false, error: "Backend not configured." };
  if (syncInProgress && activeSyncPromise) return activeSyncPromise;

  const now = Date.now();
  if (!options?.force && now - lastSyncTime < SYNC_DEBOUNCE_MS) return { ok: true };
  lastSyncTime = now;

  syncInProgress = true;
  activeSyncPromise = (async (): Promise<SyncResult> => {
    // Fetch current backend cart state
    const backendResponse = await getCart();
    if (!backendResponse.ok) {
      console.warn("[backendCart] Could not fetch backend cart, falling back to frontend-only:", backendResponse.error);
      return { ok: false, error: backendResponse.error };
    }

    const backendCart = backendResponse.data;
    const backendKeyMap = buildBackendKeyMap(backendCart);

    // For each frontend item, ensure it exists on backend with correct quantity
    for (const frontendItem of frontendCart) {
      const { productId, variationId, variationAttributes } = resolveBackendCartIdentity(frontendItem);
      if (!productId) {
        return {
          ok: false,
          error: `Could not sync “${frontendItem.name}” to WooCommerce because its backend product ID is missing.`,
        };
      }

      // Find if this item already exists on backend
      let backendItem = Array.from(backendKeyMap.values()).find(
        (item) =>
          item.product_id === productId &&
          (variationId === null || item.variation_id === variationId)
      );

      if (backendItem && backendItem.quantity !== frontendItem.quantity) {
        // Update quantity
        const updated = await updateCartItem({ key: backendItem.key, quantity: frontendItem.quantity });
        if (!updated.ok) {
          return { ok: false, error: updated.error };
        }
        backendKeyMap.delete(backendItem.key);
      } else if (!backendItem) {
        // Add new item
        const added = await addToCart({
          id: productId,
          quantity: frontendItem.quantity,
          ...(variationAttributes && Object.keys(variationAttributes).length ? { variation: variationAttributes } : {}),
        });
        if (!added.ok && variationId) {
          const variationFallback = await addToCart({ id: variationId, quantity: frontendItem.quantity });
          if (!variationFallback.ok) {
            return { ok: false, error: variationFallback.error };
          }
        } else if (!added.ok) {
          return { ok: false, error: added.error };
        }
      } else {
        // Item already correct, mark it as handled
        backendKeyMap.delete(backendItem.key);
      }
    }

    // Remove items from backend that aren't in frontend
    for (const orphanedItem of backendKeyMap.values()) {
      const removed = await removeFromCart(orphanedItem.key);
      if (!removed.ok) {
        return { ok: false, error: removed.error };
      }
    }

    if (options?.verifyForCheckout) {
      const verifiedCart = await getCart();
      if (!verifiedCart.ok) {
        return { ok: false, error: verifiedCart.error };
      }
      if (frontendCart.length > 0 && (verifiedCart.data.items?.length ?? 0) === 0) {
        return { ok: false, error: "WooCommerce still reports an empty cart after sync. Please refresh and try again." };
      }
    }

    return { ok: true };
  })().catch((error) => {
    console.warn("[backendCart] Sync error:", error instanceof Error ? error.message : error);
    return { ok: false, error: error instanceof Error ? error.message : "Cart sync failed." };
  }).finally(() => {
    syncInProgress = false;
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

/** Hook that syncs the frontend cart to the backend whenever it changes.
 * Call this at the top level of your app to enable persistent backend cart. */
export function useSyncCartToBackend(): void {
  const { items } = useCart();
  const previousItemsRef = useRef<CartLineItem[] | null>(null);

  useEffect(() => {
    // Only sync if items actually changed (not just re-renders)
    if (!previousItemsRef.current) {
      previousItemsRef.current = items;
      if (items.length > 0) {
        void syncCartToBackend(items);
      }
      return;
    }

    const itemsChanged =
      items.length !== previousItemsRef.current.length ||
      items.some(
        (item, i) =>
          !previousItemsRef.current[i] ||
          previousItemsRef.current[i].id !== item.id ||
          previousItemsRef.current[i].quantity !== item.quantity
      );

    if (itemsChanged) {
      previousItemsRef.current = items;
      void syncCartToBackend(items);
    }
  }, [items]);
}
