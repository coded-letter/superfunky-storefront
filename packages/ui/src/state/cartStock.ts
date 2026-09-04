export type CartStock = {
  stockQuantity?: number | null;
  backordersAllowed?: boolean;
};

export function clampCartQuantity(quantity: number, stock: CartStock): number {
  const { backordersAllowed, stockQuantity } = stock;
  return Math.max(
    0,
    backordersAllowed || stockQuantity == null ? quantity : Math.min(quantity, stockQuantity),
  );
}
