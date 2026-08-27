import type { ProductCardData } from "@funky/ui";
import { parseLocalizedPrice } from "../../../../packages/ui/src/locale/pricing.ts";

export function formatProductCardCurrency(
  product: ProductCardData,
  formatBaseAmount: (amount: number) => string,
): ProductCardData {
  if (!product.priceRangeLabel) return product;

  const rangeAmounts = product.priceRangeLabel
    .split(/\s+[–—-]\s+/)
    .map(parseLocalizedPrice)
    .filter((amount): amount is number => amount !== null);
  if (rangeAmounts.length < 2) return product;

  return {
    ...product,
    priceRangeLabel: rangeAmounts.map(formatBaseAmount).join(" – "),
  };
}
