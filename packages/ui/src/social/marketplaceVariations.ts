export type MarketplaceVariationAttribute = { name: string; option: string };

function normalizeAttributePart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/^attribute[_-]/, "")
    .replace(/^pa[_-]/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** WooCommerce may expose the same attribute as `Size`, `pa_size`, or
 * `attribute_pa_size`, and option casing can differ between product and variation
 * payloads. Canonical keys keep existing edit values attached to the right row. */
export function marketplaceVariationKey(attributes: MarketplaceVariationAttribute[]): string {
  return attributes
    .map(({ name, option }) => `${normalizeAttributePart(name)}:${normalizeAttributePart(option)}`)
    .sort()
    .join("|");
}

/** Derives editable attribute options from real saved variations when the parent
 * product omits its attribute collection, avoiding hard-coded phantom variations. */
export function deriveMarketplaceVariationAttributes(
  variations: Array<{ attributes: MarketplaceVariationAttribute[] }>,
): Array<{ name: string; options: string[] }> {
  const attributes = new Map<string, { name: string; options: Map<string, string> }>();
  for (const variation of variations) {
    for (const { name, option } of variation.attributes) {
      const normalizedName = normalizeAttributePart(name);
      const normalizedOption = normalizeAttributePart(option);
      if (!normalizedName || !normalizedOption) continue;
      const current = attributes.get(normalizedName) ?? { name: name.trim(), options: new Map<string, string>() };
      if (!current.options.has(normalizedOption)) current.options.set(normalizedOption, option.trim());
      attributes.set(normalizedName, current);
    }
  }
  return Array.from(attributes.values(), ({ name, options }) => ({ name, options: Array.from(options.values()) }));
}
