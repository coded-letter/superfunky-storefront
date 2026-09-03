import type { ProductDescriptionsOrder } from "../state/LayoutPreferencesContext";

export function resolveProductQuickViewDescription(
  product: { subtitle?: string; longDescription?: string },
  order: ProductDescriptionsOrder,
): string | undefined {
  return order === "long-first"
    ? product.longDescription || product.subtitle
    : product.subtitle || product.longDescription;
}
