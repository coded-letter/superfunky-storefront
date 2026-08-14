export const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export function resolveHeadingLevel(value: string | undefined, fallback: HeadingLevel): HeadingLevel {
  const normalized = value?.trim().toLowerCase();
  return HEADING_LEVELS.includes(normalized as HeadingLevel) ? normalized as HeadingLevel : fallback;
}
