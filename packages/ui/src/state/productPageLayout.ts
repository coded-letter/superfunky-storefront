export type ProductPageLayout = "classic" | "studio" | "studio-cross-sell";

export function normalizeProductPageLayout(value: unknown): ProductPageLayout {
  return value === "studio" || value === "studio-cross-sell" ? value : "classic";
}
