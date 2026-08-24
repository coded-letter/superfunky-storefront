export type ShortcodeMarker = {
  attributes: Record<string, string>;
  end: number;
  name: string;
  start: number;
};

export type SlottedShortcodeMarker = ShortcodeMarker & {
  slotId: string;
};

import { canonicalShortcodeName } from "./shortcodeRegistry.mjs";
import { parseCollectionOffset } from "./shortcodeCollections.ts";

const RAW_SHORTCODE = /\[([A-Za-z_][\w-]*)(\s+(?:"[^"]*"|'[^']*'|[^\]])*)?\s*\/?\]/g;
const MARKER = /<div\b[^>]*\bdata-funkycommerce-(?:shortcode|component)=(["'])([^"']+)\1[^>]*>\s*<\/div>/gi;
const ATTRIBUTE = /\bdata-([a-z0-9-]+)=(["'])(.*?)\2/gi;
const PROTECTED = /<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COLLECTION_SHORTCODE_NAMES = new Set([
  "categories",
  "slider",
  "carousel",
  "grid",
  "sticky-posts",
  "sticky_posts",
  "tags",
  "authors",
  "reviews",
  "comments",
  "community-feed",
  "community-marketplace",
  "community-tag-picks",
  "community-members",
  "testimonials",
]);

export function normalizeShortcodeName(name: string): string {
  const canonical = canonicalShortcodeName(name);
  if (canonical !== name.toLowerCase()) return canonical;
  const stripped = name.toLowerCase().replace(/^(funkycommerce_|woocommerce_)/, "");
  return stripped === "my_account" ? "account" : stripped;
}

export function normalizeSupportedShortcodes(html: string, supportedNames: Iterable<string>): string {
  const supported = new Set(Array.from(supportedNames, (name) => name.toLowerCase()));
  let protectedDepth = 0;

  return html.split(/(<\/?(?:pre|code|script|style)\b[^>]*>|<[^>]+>)/gi).map((part) => {
    if (/^<(pre|code|script|style)\b/i.test(part)) {
      protectedDepth += 1;
      return part;
    }
    if (/^<\/(pre|code|script|style)\b/i.test(part)) {
      protectedDepth = Math.max(0, protectedDepth - 1);
      return part;
    }
    if (protectedDepth || part.startsWith("<")) return part;

    return part.replace(RAW_SHORTCODE, (source, rawName: string, rawAttributes = "") => {
      const name = rawName.toLowerCase();
      const normalized = normalizeShortcodeName(name);
      if (!supported.has(name) && !supported.has(normalized)) return source;
      const attributes = parseRawAttributes(rawAttributes);
      const serialized = Object.entries(attributes)
        .map(([key, value]) => ` data-${escapeAttribute(key.replace(/_/g, "-"))}="${escapeAttribute(value)}"`)
        .join("");
      return `<div class="funkycommerce-headless-content-shortcode" data-funkycommerce-shortcode="${escapeAttribute(name)}"${serialized}></div>`;
    });
  }).join("");
}

export function normalizeRenderedShortcodeOutput(
  html: string,
  supportedNames: Iterable<string>,
  rawShortcodes: readonly string[],
): string {
  if (!html || !rawShortcodes.length || typeof DOMParser === "undefined") return html;

  const supported = new Set(Array.from(supportedNames, (name) => normalizeShortcodeName(name)));
  const names = rawShortcodes.flatMap((rawShortcode) =>
    Array.from(rawShortcode.matchAll(RAW_SHORTCODE), (match) => ({
      name: match[1].toLowerCase(),
      normalizedName: normalizeShortcodeName(match[1]),
    })),
  ).filter(({ normalizedName }) => supported.has(normalizedName));
  if (!names.length) return html;

  const parsed = new DOMParser().parseFromString("", "text/html");
  const root = parsed.createElement("div");
  root.innerHTML = html;
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(".funkycommerce-native"))
    .filter((element) => !element.parentElement?.closest(".funkycommerce-native"));
  const used = new Set<HTMLElement>();

  for (const { name, normalizedName } of names) {
    const nativeNames = new Set([
      name.replaceAll("_", "-"),
      normalizedName.replaceAll("_", "-"),
    ]);
    const candidate = candidates.find((element) =>
      !used.has(element)
      && Array.from(nativeNames).some((nativeName) => element.classList.contains(`funkycommerce-native-${nativeName}`)),
    );
    if (!candidate) continue;

    used.add(candidate);
    const marker = parsed.createElement("div");
    marker.className = "funkycommerce-headless-content-shortcode";
    marker.setAttribute("data-funkycommerce-shortcode", name);
    candidate.replaceWith(marker);
  }

  return root.innerHTML;
}

export function findRenderableShortcodeMarkers(html: string): ShortcodeMarker[] {
  const protectedRanges = Array.from(html.matchAll(PROTECTED), (match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const markers: ShortcodeMarker[] = [];

  for (const match of html.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (protectedRanges.some((range) => start >= range.start && start < range.end)) continue;
    const attributes: Record<string, string> = {};
    for (const attribute of match[0].matchAll(ATTRIBUTE)) {
      if (attribute[1] !== "funkycommerce-shortcode" && attribute[1] !== "funkycommerce-component") {
        attributes[attribute[1]] = decodeHtmlEntities(attribute[3]);
      }
    }
    markers.push({
      attributes,
      end: start + match[0].length,
      name: match[2].toLowerCase(),
      start,
    });
  }
  return markers;
}

export function slotRenderableShortcodeMarkers(html: string): {
  html: string;
  markers: SlottedShortcodeMarker[];
};
export function slotRenderableShortcodeMarkers(
  html: string,
  rawShortcodes?: readonly string[],
): {
  html: string;
  markers: SlottedShortcodeMarker[];
} {
  const recoveredMarkers = recoverRawShortcodeAttributes(
    findRenderableShortcodeMarkers(html),
    rawShortcodes ?? [],
  );
  const markers = recoveredMarkers.map((marker, index) => ({
    ...marker,
    slotId: `shortcode-${index}`,
  }));
  let slottedHtml = html;

  for (const marker of [...markers].reverse()) {
    const markerHtml = html.slice(marker.start, marker.end);
    const openingTagEnd = markerHtml.indexOf(">");
    const fullWidthAttribute = ["1", "true", "yes", "on"].includes(
      (marker.attributes.fullwidth ?? "").toLowerCase(),
    )
      ? ' data-funkycommerce-fullwidth="true"'
      : "";
    const slottedMarker = `${markerHtml.slice(0, openingTagEnd)} data-funkycommerce-render-slot="${marker.slotId}"${fullWidthAttribute}${markerHtml.slice(openingTagEnd)}`;
    slottedHtml = `${slottedHtml.slice(0, marker.start)}${slottedMarker}${slottedHtml.slice(marker.end)}`;
  }

  return { html: slottedHtml, markers };
}

export function recoverRawShortcodeAttributes(
  markers: readonly SlottedShortcodeMarker[],
  rawShortcodes: readonly string[],
): SlottedShortcodeMarker[];
export function recoverRawShortcodeAttributes(
  markers: readonly ShortcodeMarker[],
  rawShortcodes: readonly string[],
): ShortcodeMarker[];
export function recoverRawShortcodeAttributes<T extends ShortcodeMarker>(
  markers: readonly T[],
  rawShortcodes: readonly string[],
): T[] {
  if (!rawShortcodes.length) return [...markers];

  const rawAttributesByName = new Map<string, Record<string, string>[]>();
  for (const rawShortcode of rawShortcodes) {
    for (const match of rawShortcode.matchAll(RAW_SHORTCODE)) {
      const canonicalName = normalizeShortcodeName(match[1]);
      const attributes = parseRawAttributes(match[2] ?? "");
      if (COLLECTION_SHORTCODE_NAMES.has(canonicalName) && attributes.offset !== undefined) {
        const normalizedOffset = normalizeCollectionOffsetAttribute(attributes.offset);
        if (normalizedOffset === undefined) delete attributes.offset;
        else attributes.offset = normalizedOffset;
      }
      const occurrences = rawAttributesByName.get(canonicalName) ?? [];
      occurrences.push(attributes);
      rawAttributesByName.set(canonicalName, occurrences);
    }
  }

  const occurrenceByName = new Map<string, number>();
  return markers.map((marker) => {
    const canonicalName = normalizeShortcodeName(marker.name);
    const occurrence = occurrenceByName.get(canonicalName) ?? 0;
    occurrenceByName.set(canonicalName, occurrence + 1);
    const rawAttributes = rawAttributesByName.get(canonicalName)?.[occurrence];
    if (!rawAttributes) return marker;
    const recoveredAttributes = { ...rawAttributes };
    if (marker.attributes.offset !== undefined) delete recoveredAttributes.offset;
    return {
      ...marker,
      attributes: {
        ...marker.attributes,
        ...recoveredAttributes,
      },
    };
  });
}

function parseRawAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase().replace(/_/g, "-")] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === "undefined") {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function normalizeCollectionOffsetAttribute(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return String(parseCollectionOffset(value));
}
