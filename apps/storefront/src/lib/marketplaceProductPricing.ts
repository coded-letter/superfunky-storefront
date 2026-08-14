export type MarketplaceProductPriceType = "simple" | "variable" | "external";

/** WooCommerce variable-product mutations still require a top-level price even though
 * the purchasable prices live on variations. Use the lowest variation price instead of
 * an unrelated zero placeholder. */
export function resolveMarketplaceMutationPrice(
  productType: MarketplaceProductPriceType,
  productPrice: number,
  variationPrices: number[],
): number {
  if (productType !== "variable") return productPrice;
  const validPrices = variationPrices.filter((price) => Number.isFinite(price) && price >= 0);
  return validPrices.length > 0 ? Math.min(...validPrices) : productPrice;
}
