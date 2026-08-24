/** Per-product price presentation resolution — deliberately dependency-free (only a
 *  type-only import, which is fully erased at build/runtime) so this pure logic can
 *  be exercised in isolation from the rest of the storefront's data-fetching layer. */
import type { NoPriceBehavior } from "./navigation.ts";

export type { NoPriceBehavior };

/** Per-product override of the store-wide {@link NoPriceBehavior}. `"inherit"` (the
 *  default) defers to the store setting; `"free"` or `"inquiry"` force that treatment
 *  for this product regardless of the store-wide default. */
export type ProductPriceBehavior = "inherit" | "free" | "inquiry";

/** How a product should actually be presented once price data, the per-product
 *  override, and the store-wide default have all been reconciled. */
export type ResolvedProductPriceMode = "purchase" | "free" | "inquiry";

/** Resolve how a product's pricing should be presented, preserving explicit free
 *  products (an actual price of 0) even when the effective no-price behaviour is
 *  "inquiry" — only products with *no* price data at all are subject to the
 *  no-price behaviour. Per-product `priceBehavior` overrides take precedence over
 *  the store-wide `noPriceBehavior` default unless it is `"inherit"`. */
export function resolveProductPriceMode(
  priceAmount: number | undefined,
  priceBehavior: ProductPriceBehavior,
  noPriceBehavior: NoPriceBehavior,
): ResolvedProductPriceMode {
  if (priceAmount !== undefined && priceAmount > 0) return "purchase";
  if (priceAmount === 0) return "free";
  const effective = priceBehavior === "inherit" ? noPriceBehavior : priceBehavior;
  return effective === "inquiry" ? "inquiry" : "free";
}

function isProductPriceBehavior(value: unknown): value is ProductPriceBehavior {
  return value === "inherit" || value === "free" || value === "inquiry";
}

/** Normalize a raw backend value (e.g. from GraphQL) to a {@link ProductPriceBehavior},
 *  defaulting to `"inherit"` for anything unrecognised. */
export function normalizeProductPriceBehavior(value: unknown): ProductPriceBehavior {
  return isProductPriceBehavior(value) ? value : "inherit";
}
