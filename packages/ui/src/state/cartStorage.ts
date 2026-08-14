import type { CartLineItem } from "./CartContext";

export const CART_STORAGE_KEY = "funky-cart-v2";
export const LEGACY_CART_STORAGE_KEY = "funky-cart-v1";

const DISPOSABLE_CACHE_PREFIX = "funkycommerce-isg-cache:";
const MAX_PERSISTED_IMAGE_URL_LENGTH = 2_048;

type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export type CartPersistenceResult =
  | { medium: "local" | "session" }
  | { medium: "memory"; error: unknown };

export function readStoredCartItems(localStorage: CartStorage, sessionStorage: CartStorage): CartLineItem[] {
  const candidates: [CartStorage, string][] = [
    [localStorage, CART_STORAGE_KEY],
    [sessionStorage, CART_STORAGE_KEY],
    [localStorage, LEGACY_CART_STORAGE_KEY],
  ];

  for (const [storage, key] of candidates) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CartLineItem[];
      storage.removeItem(key);
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        // Continue to the next persistence layer when this storage is unavailable.
      }
    }
  }

  return [];
}

export function persistCartItems(
  items: CartLineItem[],
  localStorage: CartStorage,
  sessionStorage: CartStorage,
): CartPersistenceResult {
  const payload = serializeCartItems(items);

  try {
    localStorage.setItem(CART_STORAGE_KEY, payload);
    removeOptionalItem(sessionStorage, CART_STORAGE_KEY);
    removeOptionalItem(localStorage, LEGACY_CART_STORAGE_KEY);
    return { medium: "local" };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      removeOptionalItem(localStorage, LEGACY_CART_STORAGE_KEY);
      removeDisposableCaches(localStorage);
      try {
        localStorage.setItem(CART_STORAGE_KEY, payload);
        removeOptionalItem(sessionStorage, CART_STORAGE_KEY);
        return { medium: "local" };
      } catch {
        // Session storage is the final persistent fallback below.
      }
    }
  }

  try {
    sessionStorage.setItem(CART_STORAGE_KEY, payload);
    removeOptionalItem(localStorage, CART_STORAGE_KEY);
    return { medium: "session" };
  } catch (error) {
    return { medium: "memory", error };
  }
}

export function serializeCartItems(items: CartLineItem[]): string {
  return JSON.stringify(items.map((item) => {
    if (isPersistableImageUrl(item.imageUrl)) return item;
    const { imageUrl: _imageUrl, ...persistedItem } = item;
    return persistedItem;
  }));
}

function isPersistableImageUrl(imageUrl: string | undefined): imageUrl is string {
  if (!imageUrl || imageUrl.length > MAX_PERSISTED_IMAGE_URL_LENGTH) return false;
  return !/^(?:blob|data):/i.test(imageUrl);
}

function removeDisposableCaches(storage: CartStorage): void {
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(DISPOSABLE_CACHE_PREFIX)) keys.push(key);
    }
  } catch {
    return;
  }
  keys.forEach((key) => removeOptionalItem(storage, key));
}

function removeOptionalItem(storage: CartStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Cleanup must not interrupt the cart update.
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}
