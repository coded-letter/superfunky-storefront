import assert from "node:assert/strict";
import { test } from "node:test";
import type { CartLineItem } from "./CartContext.tsx";
import {
  CART_STORAGE_KEY,
  persistCartItems,
  readStoredCartItems,
  serializeCartItems,
} from "./cartStorage.ts";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  readonly #quota: number;

  constructor(quota = Number.POSITIVE_INFINITY) {
    this.#quota = quota;
  }

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    const nextValues = new Map(this.#values);
    nextValues.set(key, value);
    const size = [...nextValues].reduce((total, [itemKey, itemValue]) => total + itemKey.length + itemValue.length, 0);
    if (size > this.#quota) throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    this.#values.set(key, value);
  }
}

const cartItem: CartLineItem = {
  id: "product-1",
  backendProductId: 42,
  name: "Example product",
  imageUrl: "https://cdn.example.com/product.webp",
  priceLabel: "$12.00",
  priceAmount: 12,
  quantity: 1,
};

test("cart serialization omits image payloads that can exhaust browser storage", () => {
  const serialized = serializeCartItems([
    { ...cartItem, imageUrl: `data:image/png;base64,${"a".repeat(10_000)}` },
    { ...cartItem, id: "product-2" },
  ]);
  const parsed = JSON.parse(serialized) as CartLineItem[];

  assert.equal(parsed[0]?.imageUrl, undefined);
  assert.equal(parsed[1]?.imageUrl, cartItem.imageUrl);
});

test("cart persistence evicts disposable CMS caches and retries after a quota error", () => {
  const localStorage = new MemoryStorage(700);
  const sessionStorage = new MemoryStorage();
  localStorage.setItem("funkycommerce-isg-cache:catalog", "x".repeat(500));

  const result = persistCartItems([cartItem], localStorage, sessionStorage);

  assert.deepEqual(result, { medium: "local" });
  assert.equal(localStorage.getItem("funkycommerce-isg-cache:catalog"), null);
  assert.ok(localStorage.getItem(CART_STORAGE_KEY));
  assert.equal(sessionStorage.getItem(CART_STORAGE_KEY), null);
});

test("cart persistence falls back to session storage when local storage cannot fit the cart", () => {
  const localStorage = new MemoryStorage(100);
  const sessionStorage = new MemoryStorage();
  localStorage.setItem(CART_STORAGE_KEY, "[]");

  const result = persistCartItems([cartItem], localStorage, sessionStorage);

  assert.deepEqual(result, { medium: "session" });
  assert.equal(localStorage.getItem(CART_STORAGE_KEY), null);
  assert.deepEqual(readStoredCartItems(localStorage, sessionStorage), [cartItem]);
});
