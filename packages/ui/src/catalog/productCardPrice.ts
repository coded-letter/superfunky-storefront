export type ProductCardPriceInput = {
  priceAmount?: number;
  priceLabel?: string;
  priceRangeLabel?: string;
  variationPriceAmounts?: number[];
};

/** Treat zero as missing pricing data so unpriced products use their learn-more
 * action instead of showing a misleading free price. Labels remain supported for
 * legacy/mock card data when no numeric amount is available. */
export function hasProductCardPrice({
  priceAmount,
  priceLabel,
  priceRangeLabel,
  variationPriceAmounts = [],
}: ProductCardPriceInput): boolean {
  if (Number.isFinite(priceAmount)) return (priceAmount ?? 0) > 0;
  if (variationPriceAmounts.length) {
    return variationPriceAmounts.some((amount) => Number.isFinite(amount) && amount > 0);
  }
  return Boolean(priceRangeLabel?.trim() || priceLabel?.trim());
}
