import type { ProductCardData } from "@funky/ui";
import { parseLocalizedPrice } from "../../../../packages/ui/src/locale/pricing.ts";

export function formatProductCardCurrency(
  product: ProductCardData,
  formatBaseAmount: (amount: number) => string,
): ProductCardData {
  const formatLabel = (label: string | undefined, amount: number | undefined) => {
    const resolvedAmount = amount ?? (label ? parseLocalizedPrice(label) ?? undefined : undefined);
    return resolvedAmount === undefined ? label : formatBaseAmount(resolvedAmount);
  };
  const rangeAmounts = product.priceRangeLabel
    ?.split(/\s+[–—-]\s+/)
    .map(parseLocalizedPrice)
    .filter((amount): amount is number => amount !== null);
  const priceRangeLabel = rangeAmounts && rangeAmounts.length >= 2
    ? rangeAmounts.map(formatBaseAmount).join(" – ")
    : product.priceRangeLabel;
  const priceLabel = product.priceLabel === product.priceRangeLabel && priceRangeLabel
    ? priceRangeLabel
    : formatLabel(product.priceLabel, product.priceAmount) || "";

  return {
    ...product,
    priceLabel,
    compareAtPriceLabel: formatLabel(product.compareAtPriceLabel, product.compareAtPriceAmount),
    priceRangeLabel,
    variations: product.variations?.map((variation) => ({
      ...variation,
      priceLabel: formatLabel(variation.priceLabel, variation.priceAmount) || "",
      compareAtPriceLabel: formatLabel(
        variation.compareAtPriceLabel,
        variation.compareAtPriceAmount,
      ),
    })),
  };
}
