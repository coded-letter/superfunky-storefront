import type {
  ProductCardData,
  ProductCardVariation,
} from "../catalog/ProductCard";

export function getCartRecommendationHref(product: ProductCardData): string {
  return product.href || "/shop";
}

export function resolveCartRecommendationVariation(
  product: ProductCardData,
  selectedOptions: Record<string, string>,
): ProductCardVariation | undefined {
  const requiredLabels = product.variationOptions?.map((option) => option.label)
    ?? Object.keys(product.variations?.[0]?.attributes ?? {});
  if (requiredLabels.some((label) => !selectedOptions[label])) return undefined;

  return product.variations?.find(
    (variation) =>
      variation.inStock
      && Object.entries(selectedOptions).every(
        ([label, value]) => variation.attributes[label] === value,
      ),
  );
}

export function isCartRecommendationOptionAvailable(
  product: ProductCardData,
  selectedOptions: Record<string, string>,
  optionLabel: string,
  optionValue: string,
): boolean {
  return product.variations?.some(
    (variation) =>
      variation.inStock
      && variation.attributes[optionLabel] === optionValue
      && Object.entries(selectedOptions).every(
        ([label, value]) =>
          !value
          || label === optionLabel
          || variation.attributes[label] === value,
      ),
  ) ?? false;
}
