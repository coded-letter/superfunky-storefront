import { decodeHTMLStrict } from "entities";

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "cite", "code", "dd", "del", "div", "dl", "dt",
  "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "ins", "kbd", "li", "mark",
  "ol", "p", "pre", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
]);
const VOID_TAGS = new Set(["br", "hr"]);
const BLOCKED_ELEMENT_PATTERN = /<(script|style|iframe|object|embed|form|input|button|select|textarea|template|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function sanitizeStorefrontHtml(html: string | null | undefined): string {
  if (typeof html !== "string" || !html.trim()) return "";

  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCKED_ELEMENT_PATTERN, "")
    .replace(/<\/?([a-z0-9-]+)\b[^>]*>/gi, (source, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (source.startsWith("</")) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      if (tag === "a") return sanitizeAnchor(source);
      return `<${tag}>`;
    })
    .trim();
}

function sanitizeAnchor(source: string): string {
  const href = sanitizeLink(readAttribute(source, "href"));
  const title = readAttribute(source, "title");
  const attributes = [
    href ? ` href="${escapeAttribute(href.value)}"` : "",
    title ? ` title="${escapeAttribute(decodeHTMLStrict(title))}"` : "",
    href?.external ? ' target="_blank" rel="noopener noreferrer"' : "",
  ];
  return `<a${attributes.join("")}>`;
}

function readAttribute(source: string, name: string): string {
  const match = source.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function sanitizeLink(rawValue: string): { value: string; external: boolean } | null {
  const value = decodeHTMLStrict(rawValue).trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^(?:mailto:[^@\s]+@[^@\s]+|tel:\+?[0-9().\s-]+)$/i.test(value)) {
    return { value, external: false };
  }

  try {
    const base = new URL("https://storefront.invalid/");
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const external = url.origin !== base.origin;
    return {
      value: external ? url.toString() : `${url.pathname}${url.search}${url.hash}`,
      external,
    };
  } catch {
    return null;
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
