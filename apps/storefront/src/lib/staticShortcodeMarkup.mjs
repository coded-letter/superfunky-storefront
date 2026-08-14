import { SUPPORTED_SHORTCODE_NAMES } from "./shortcodeRegistry.mjs";

const SUPPORTED = new Set(SUPPORTED_SHORTCODE_NAMES);
const RAW_SHORTCODE = /\[([A-Za-z_][\w-]*)(\s+(?:"[^"]*"|'[^']*'|[^\]])*)?\s*\/?\]/g;
const EMPTY_MARKER = /(<div\b[^>]*\bdata-funkycommerce-(?:shortcode|component)=(["'])([^"']+)\2[^>]*>)\s*<\/div>/gi;

export function normalizeStaticShortcodes(html, { placeholders = false } = {}) {
  let protectedDepth = 0;
  const normalized = html.split(/(<\/?(?:pre|code|script|style)\b[^>]*>|<[^>]+>)/gi).map((part) => {
    if (/^<(pre|code|script|style)\b/i.test(part)) {
      protectedDepth += 1;
      return part;
    }
    if (/^<\/(pre|code|script|style)\b/i.test(part)) {
      protectedDepth = Math.max(0, protectedDepth - 1);
      return part;
    }
    if (protectedDepth || part.startsWith("<")) return part;
    return part.replace(RAW_SHORTCODE, (source, rawName, rawAttributes = "") => {
      const name = rawName.toLowerCase();
      if (!SUPPORTED.has(name)) return source;
      const attributes = [];
      const pattern = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
      for (const match of rawAttributes.matchAll(pattern)) {
        const key = match[1].toLowerCase().replaceAll("_", "-");
        const value = match[2] ?? match[3] ?? match[4] ?? "";
        attributes.push(` data-${escapeAttribute(key)}="${escapeAttribute(value)}"`);
      }
      return `<div class="funkycommerce-headless-content-shortcode" data-funkycommerce-shortcode="${escapeAttribute(name)}"${attributes.join("")}></div>`;
    });
  }).join("");

  if (!placeholders) return normalized;
  return normalized.replace(EMPTY_MARKER, (source, opening, _quote, rawName) => {
    const name = rawName.toLowerCase();
    if (!SUPPORTED.has(name)) return source;
    const label = escapeAttribute(name.replaceAll("_", " ").replaceAll("-", " "));
    return `${opening}<div class="shortcode-prerender-fallback shortcode-prerender-fallback--${staticShortcodeSize(name)}" data-prerendered-shortcode="${escapeAttribute(name)}" role="status" aria-label="Loading ${label}"></div></div>`;
  });
}

function staticShortcodeSize(name) {
  if (["hero", "community-hero"].includes(name)) return "hero";
  if (["funkycommerce_map", "gml_map"].includes(name)) return "map";
  if (["cart", "checkout", "account", "auth"].some((value) => name.endsWith(value))) return "application";
  return "content";
}

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
