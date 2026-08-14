export type ShortcodeAttrValue = string | number | boolean | string[];

function formatShortcodeAttrValue(value: ShortcodeAttrValue): string {
  return Array.isArray(value) ? value.join(",") : String(value);
}

export function buildShortcode(name: string, attrs: Record<string, ShortcodeAttrValue>): string {
  const entries = Object.entries(attrs).filter(([, value]) => value !== undefined && value !== "");
  return `[${name}${entries.length ? " " : ""}${entries
    .map(([key, value]) => `${key}="${formatShortcodeAttrValue(value)}"`)
    .join(" ")}]`;
}
