import type { ProductType } from "./ProductCard";

type ProductCtaData = {
  productType?: ProductType;
  inStock?: boolean;
  variations?: Array<{ inStock: boolean }>;
};

export function isOutOfStockVariableProduct(product: ProductCtaData): boolean {
  if (product.productType !== "variable") return false;
  if (product.inStock === false) return true;

  return Boolean(product.variations?.length && product.variations.every((variation) => !variation.inStock));
}

export function shouldShowProductLearnMore(product: ProductCtaData, hasPrice: boolean): boolean {
  if (product.productType === "external" || product.productType === "grouped") return false;

  return !hasPrice || product.inStock === false || isOutOfStockVariableProduct(product);
}
