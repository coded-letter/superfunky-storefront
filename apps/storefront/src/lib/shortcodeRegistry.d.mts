export const CONTENT_SHORTCODE_NAMES: readonly string[];
export const APPLICATION_SHORTCODE_NAMES: readonly string[];
export const SHORTCODE_ALIASES: Readonly<Record<string, string>>;
export const SUPPORTED_SHORTCODE_NAMES: readonly string[];
export function canonicalShortcodeName(name: string): string;
