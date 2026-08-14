import { decodeHTMLStrict } from "entities";

/**
 * Decode one transport-encoding layer from a CMS label. A single pass is
 * intentional: `&amp;amp;` represents the literal text `&amp;`, not `&`.
 */
export function normalizeDisplayLabel(value: string): string {
  return decodeHTMLStrict(value);
}

export function normalizeBackendError(value: string): string {
  return normalizeDisplayLabel(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}
