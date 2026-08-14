import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseLocalizedPrice, useCurrency } from "../locale";
import { persistCartItems, readStoredCartItems } from "./cartStorage";
import { mergeCartLineItemsByMaxQuantity, type MergeCartItemInput } from "./cartMerge";

export type CartLineItem = {
  /** Unique cart line id — usually the product id, or `${productId}-${variantLabel}`
   * when the same product can be added again with a different variant. */
  id: string;
  /** Numeric WooCommerce product ID used for backend cart/order sync. */
  backendProductId?: number;
  /** Numeric WooCommerce variation ID used for backend cart/order sync. */
  backendVariationId?: number;
  /** Attribute map used when re-adding a variable product to the Woo Store API cart. */
  variationAttributes?: Record<string, string>;
  /** Whether WooCommerce treats this line as virtual/non-shippable. */
  virtual?: boolean;
  name: string;
  variantLabel?: string;
  imageUrl?: string;
  priceLabel: string;
  /** Unit price in the WooCommerce base currency. */
  priceAmount?: number;
  quantity: number;
};

export type AddCartItemInput = Omit<CartLineItem, "quantity">;

export type CartContextValue = {
  items: CartLineItem[];
  itemCount: number;
  subtotalAmount: number;
  subtotalLabel: string;
  isHydrated: boolean;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addItem: (item: AddCartItemInput, quantity?: number) => void;
  mergeItem: (item: AddCartItemInput, quantity?: number) => void;
  mergeItems: (items: MergeCartItemInput[]) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { formatBaseAmount } = useCurrency();
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const didWarnAboutPersistence = useRef(false);

  useEffect(() => {
    setItems(readStoredCartItems(window.localStorage, window.sessionStorage));
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const result = persistCartItems(items, window.localStorage, window.sessionStorage);
    if (result.medium === "memory") {
      if (!didWarnAboutPersistence.current) {
        console.warn("Cart storage is unavailable; the cart will remain available for this page session.", result.error);
        didWarnAboutPersistence.current = true;
      }
    } else {
      didWarnAboutPersistence.current = false;
    }
  }, [items, isHydrated]);

  const value = useMemo<CartContextValue>(() => {
    const normalizedItems = items.map((item) => {
      const priceAmount = item.priceAmount ?? parseLocalizedPrice(item.priceLabel) ?? 0;
      return {
        ...item,
        priceAmount,
        priceLabel: formatBaseAmount(priceAmount),
      };
    });
    const subtotalAmount = normalizedItems.reduce((sum, item) => sum + (item.priceAmount || 0) * item.quantity, 0);
    return {
      items: normalizedItems,
      itemCount: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotalAmount,
      subtotalLabel: formatBaseAmount(subtotalAmount),
      isHydrated,
      isDrawerOpen,
      openDrawer: () => setIsDrawerOpen(true),
      closeDrawer: () => setIsDrawerOpen(false),
      toggleDrawer: () => setIsDrawerOpen((value) => !value),
      addItem: (item, quantity = 1) =>
        setItems((previous) => {
          const existing = previous.find((line) => line.id === item.id);
          if (existing) {
            return previous.map((line) => (line.id === item.id ? { ...line, quantity: line.quantity + quantity } : line));
          }
          return [...previous, { ...item, quantity }];
        }),
      mergeItem: (item, quantity = 1) =>
        setItems((previous) =>
          mergeCartLineItemsByMaxQuantity(previous, [{ ...item, quantity }]),
        ),
      mergeItems: (incomingItems) =>
        setItems((previous) => mergeCartLineItemsByMaxQuantity(previous, incomingItems)),
      removeItem: (id) => setItems((previous) => previous.filter((line) => line.id !== id)),
      updateQuantity: (id, quantity) =>
        setItems((previous) =>
          quantity <= 0
            ? previous.filter((line) => line.id !== id)
            : previous.map((line) => (line.id === id ? { ...line, quantity } : line)),
        ),
      clear: () => setItems([]),
    };
  }, [formatBaseAmount, isHydrated, items, isDrawerOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
