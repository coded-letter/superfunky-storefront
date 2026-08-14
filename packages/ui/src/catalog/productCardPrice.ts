export type ProductCardPriceInput = {
  priceAmount?: number;
  priceLabel?: string;
  priceRangeLabel?: string;
  variationPriceAmounts?: number[];
};

/** Treat an explicit zero as a real price while rejecting products whose pricing data
 * is entirely absent. Labels remain supported for legacy/mock card data. */
export function hasProductCardPrice({
  priceAmount,
  priceLabel,
  priceRangeLabel,
  variationPriceAmounts = [],
}: ProductCardPriceInput): boolean {
  if (Number.isFinite(priceAmount) && (priceAmount ?? -1) >= 0) return true;
  if (variationPriceAmounts.some((amount) => Number.isFinite(amount) && amount >= 0)) return true;
  return Boolean(priceRangeLabel?.trim() || priceLabel?.trim());
}
