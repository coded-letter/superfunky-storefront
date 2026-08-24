const COLOR_ATTRIBUTE_PATTERN = /(^|[\s_-])(colou?r|swatch)([\s_-]|$)/i;

export function resolveVariationSwatchColor(
  optionLabel: string,
  value: string,
  explicitColor?: string,
): string | undefined {
  const candidate = (explicitColor || (COLOR_ATTRIBUTE_PATTERN.test(optionLabel) ? value : "")).trim();
  if (!candidate) return undefined;
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", candidate) ? candidate : undefined;
  }
  return /^(#[\da-f]{3,8}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(.+\)|[a-z]+)$/i.test(candidate)
    ? candidate
    : undefined;
}
