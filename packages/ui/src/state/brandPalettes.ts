import {
  applyBrandPalette as applyBrandPaletteRuntime,
  brandPaletteCssVariables as createBrandPaletteCssVariables,
  BRAND_COLOR_STEPS as colorSteps,
  BRAND_GRADIENT_STYLE_OPTIONS as gradientStyleOptions,
  BRAND_PALETTE_OPTIONS as paletteOptions,
  BRAND_PALETTES as palettes,
} from "./brandPalettes.mjs";

export type BrandColorStep = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950";

export type BrandPaletteId =
  | "violet"
  | "sunset"
  | "ocean"
  | "forest"
  | "rose"
  | "indigo"
  | "coral"
  | "teal"
  | "amber"
  | "berry"
  | "slate"
  | "mint"
  | "plum"
  | "citrus"
  | "sky"
  | "ember"
  | "lagoon"
  | "blush"
  | "olive"
  | "midnight";

export type BrandGradientStyle = "gradient" | "flat";

export type BrandPalette = {
  label: string;
  description: string;
  scale: Record<BrandColorStep, string>;
  gradientFrom: string;
  gradientTo: string;
};

export const BRAND_COLOR_STEPS = colorSteps as BrandColorStep[];
export const BRAND_GRADIENT_STYLE_OPTIONS = gradientStyleOptions as {
  value: BrandGradientStyle;
  label: string;
}[];
export const BRAND_PALETTES = palettes as Record<BrandPaletteId, BrandPalette>;
export const BRAND_PALETTE_OPTIONS = paletteOptions as {
  value: BrandPaletteId;
  label: string;
}[];

export function brandPaletteCssVariables(
  paletteId: BrandPaletteId,
  gradientStyle: BrandGradientStyle = "gradient",
): string[] {
  return createBrandPaletteCssVariables(paletteId, gradientStyle);
}

export function applyBrandPalette(
  paletteId: BrandPaletteId,
  gradientStyle: BrandGradientStyle = "gradient",
): void {
  applyBrandPaletteRuntime(paletteId, gradientStyle);
}
