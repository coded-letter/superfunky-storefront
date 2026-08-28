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
    if (name === "hero" || name === "community-hero" || name === "video-hero") {
      return `${opening}${renderStaticHero(opening, name)}</div>`;
    }
    const label = escapeAttribute(name.replaceAll("_", " ").replaceAll("-", " "));
    return `${opening}<div class="shortcode-prerender-fallback shortcode-prerender-fallback--${staticShortcodeSize(name)}" data-prerendered-shortcode="${escapeAttribute(name)}" role="status" aria-label="Loading ${label}"></div></div>`;
  });
}

function renderStaticHero(opening, name) {
  const variant = oneOf(readDataAttribute(opening, "variant"), ["glow", "fullbleed", "split", "minimal", "strip"], "fullbleed");
  const headingLevel = oneOf(readDataAttribute(opening, "heading-level"), ["h1", "h2", "h3", "h4", "h5", "h6"], "h1");
  const kicker = readDataAttribute(opening, "pill") || readDataAttribute(opening, "kicker");
  const title = readDataAttribute(opening, "h1") || readDataAttribute(opening, "title") || "Storefront hero";
  const description = readDataAttribute(opening, "p") || readDataAttribute(opening, "description");
  const image = safeMediaUrl(
    readDataAttribute(opening, "bgimg")
    || readDataAttribute(opening, "bg-image")
    || readDataAttribute(opening, "image")
    || readDataAttribute(opening, "poster")
    || readDataAttribute(opening, "background-image"),
  );
  const height = safeCssLength(readDataAttribute(opening, "height"));
  const primaryCta = renderStaticCta(opening, "primary", true);
  const secondaryCta = renderStaticCta(opening, "secondary", false);
  const imageMarkup = image
    ? `<img class="shortcode-prerender-hero__image" src="${escapeAttribute(image)}" alt="" aria-hidden="true">`
    : "";
  const kickerMarkup = kicker
    ? `<span class="shortcode-prerender-hero__kicker">${escapeAttribute(kicker)}</span>`
    : "";
  const descriptionMarkup = description
    ? `<p class="shortcode-prerender-hero__description">${escapeAttribute(description)}</p>`
    : "";
  const heightAttribute = height ? ` data-prerender-min-height="${escapeAttribute(height)}"` : "";
  const isVideoHero = name === "video-hero";
  const hasSupportedVideo = isVideoHero && isSupportedVideoSource(
    readDataAttribute(opening, "src") || readDataAttribute(opening, "video"),
  );
  const activationAttribute = hasSupportedVideo ? " data-storefront-activate" : "";
  const posterAttribute = hasSupportedVideo ? ` data-prerender-video-poster="${image ? "true" : "false"}"` : "";
  const startsAutomatically = readBooleanAttribute(opening, "autoplay", true)
    && readBooleanAttribute(opening, "muted", true);
  const videoControl = hasSupportedVideo
    ? `<button type="button" class="shortcode-prerender-hero__play" data-storefront-control="video-hero-play" data-storefront-activate${startsAutomatically ? " data-storefront-activate-only" : ""} aria-label="Play background video"><span aria-hidden="true">&#9654;</span></button>`
    : "";

  return `<section class="shortcode-prerender-hero shortcode-prerender-hero--${variant}" data-prerendered-shortcode="${escapeAttribute(name)}"${heightAttribute}${activationAttribute}${posterAttribute} aria-label="${escapeAttribute(title)}">
    ${imageMarkup}
    <span class="shortcode-prerender-hero__overlay" aria-hidden="true"></span>
    <div class="shortcode-prerender-hero__container">
      <div class="shortcode-prerender-hero__inner">
        ${kickerMarkup}
        <${headingLevel} class="shortcode-prerender-hero__title">${escapeAttribute(title)}</${headingLevel}>
        ${descriptionMarkup}
        ${primaryCta || secondaryCta ? `<div class="shortcode-prerender-hero__actions">${primaryCta}${secondaryCta}</div>` : ""}
      </div>
    </div>
    ${videoControl}
  </section>`;
}

function renderStaticCta(opening, prefix, primary) {
  const label = readDataAttribute(opening, `${prefix}-cta-label`);
  const href = safeHref(readDataAttribute(opening, `${prefix}-cta-href`));
  if (!label || !href) return "";
  const target = readDataAttribute(opening, `${prefix}-cta-target`) === "_blank" ? "_blank" : "_self";
  const rel = target === "_blank" ? ' rel="noopener noreferrer"' : "";
  return `<a class="shortcode-prerender-hero__cta${primary ? " shortcode-prerender-hero__cta--primary" : ""}" href="${escapeAttribute(href)}" target="${target}"${rel}>${escapeAttribute(label)}</a>`;
}

function readDataAttribute(opening, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = opening.match(new RegExp(`\\sdata-${escapedName}=(["'])(.*?)\\1`, "i"));
  return decodeAttribute(match?.[2]?.trim() || "");
}

function readBooleanAttribute(opening, name, fallback) {
  const value = readDataAttribute(opening, name).toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function decodeAttribute(value) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function safeHref(value) {
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : "";
  } catch {
    return "";
  }
}

function safeMediaUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : "";
  } catch {
    return "";
  }
}

function isSupportedVideoSource(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (/\.(mp4|webm)(?:$|\?)/i.test(url.href)) return true;
    if (url.hostname === "youtu.be") return Boolean(url.pathname.split("/").filter(Boolean)[0]);
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      return Boolean(url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]);
    }
    if (/(^|\.)vimeo\.com$/.test(url.hostname)) {
      return Boolean(url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1]);
    }
  } catch {
    return false;
  }
  return false;
}

function safeCssLength(value) {
  return /^(?:\d+(?:\.\d+)?)(?:px|rem|vh|svh|dvh)$/i.test(value) ? value : "";
}

function oneOf(value, values, fallback) {
  return values.includes(value) ? value : fallback;
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
