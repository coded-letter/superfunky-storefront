export type ProductPageLayout = "classic" | "studio";

export function normalizeProductPageLayout(value: unknown): ProductPageLayout {
  return value === "studio" ? "studio" : "classic";
}
