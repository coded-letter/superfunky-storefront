import { submitFormSubmission, submitNewsletterSubmission } from "./submissions.ts";
import { addDefaultCmsIconDimensions } from "./cmsIconSizing.mjs";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { storefrontProxiedMediaUrl } from "./storefrontMediaAssets.ts";

export type CmsBehaviorId = keyof typeof CMS_BEHAVIOR_REGISTRY;

type Cleanup = () => void;
type BehaviorMount = (container: HTMLElement) => Cleanup;

const warned = new Set<string>();
const activeMounts = new WeakMap<HTMLElement, Map<CmsBehaviorId, Cleanup>>();

const CMS_STYLE_PROPERTIES = new Set([
  "align-items", "aspect-ratio", "background", "background-color", "background-image", "background-position",
  "background-repeat", "background-size", "border", "border-color", "border-radius", "border-style",
  "border-width", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius",
  "border-bottom-right-radius", "box-shadow", "color", "column-count", "column-gap", "display", "flex",
  "flex-basis", "flex-direction", "flex-grow", "flex-shrink", "flex-wrap", "font-family", "font-size",
  "font-style", "font-weight", "gap", "height", "justify-content", "letter-spacing", "line-height", "margin", "margin-block",
  "margin-block-end", "margin-block-start", "margin-bottom", "margin-inline", "margin-inline-end",
  "margin-inline-start", "margin-left", "margin-right", "margin-top", "max-height", "max-width",
  "min-height", "min-width", "object-fit", "opacity", "order", "overflow", "overflow-x", "overflow-y",
  "padding", "padding-block", "padding-block-end", "padding-block-start", "padding-bottom",
  "padding-inline", "padding-inline-end", "padding-inline-start", "padding-left", "padding-right",
  "padding-top", "position", "text-align", "text-decoration", "text-indent", "text-transform",
  "vertical-align", "width", "writing-mode",
]);
const LENGTH_PROPERTIES = /^(?:flex-basis|font-size|height|max-height|max-width|min-height|min-width|width)$/;
const BOX_PROPERTIES = /^(?:margin|padding)(?:$|-(?:block|inline)(?:-(?:start|end))?$|-(?:top|right|bottom|left)$)/;
const FORBIDDEN_CSS = /(?:@import|expression\s*\(|behaviou?r\s*:|-moz-binding|javascript\s*:|vbscript\s*:|data\s*:|(?:position\s*:\s*(?:fixed|sticky|absolute)))/i;
const SAFE_CSS_VARIABLE = /^var\(--wp--(?:preset|style)--[a-z0-9-]+(?:--[a-z0-9-]+)*\)$/i;
const CMS_GEOMETRY_CLASS = /^(?:container|mx-auto|has-global-padding|(?:[^:]+:)*(?:max-w-.+|min-w-.+|w-screen))$/;
const CMS_WRAPPER_PADDING_CLASS = /^(?:[^:]+:)*(?:px-.+|pl-.+|pr-.+)$/;

export function sanitizeCmsStyleAttribute(style: string): string {
  if (!style || style.length > 2_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\\]/.test(style) || FORBIDDEN_CSS.test(style)) return "";

  return style.split(";").flatMap((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 1) return [];
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!CMS_STYLE_PROPERTIES.has(property) || !isSafeCmsStyleValue(property, rawValue)) return [];
    return [`${property}: ${rawValue}`];
  }).join("; ");
}

function isSafeCmsStyleValue(property: string, rawValue: string): boolean {
  if (!rawValue || rawValue.length > 300 || /[{}@<>`]/.test(rawValue) || FORBIDDEN_CSS.test(`${property}:${rawValue}`)) return false;
  const value = rawValue.replace(/\s*!important\s*$/i, "").trim();
  if (!value) return false;

  if (property === "background") return isSafeGradient(value);
  if (property === "background-image") return isSafeBackgroundImage(value);
  if (property === "background-position") return isSafeBackgroundPosition(value);
  if (property === "background-repeat") return /^(?:repeat|repeat-x|repeat-y|no-repeat|space|round)$/i.test(value);
  if (property === "background-size") {
    return /^(?:auto|cover|contain)$/i.test(value)
      || (value.split(/\s+/).length <= 2 && value.split(/\s+/).every((part) => isLength(part, true)));
  }
  if (/[\"']/.test(value)) return false;
  if (LENGTH_PROPERTIES.test(property)) return isLength(value, true, property === "font-size");
  if (BOX_PROPERTIES.test(property)) return value.split(/\s+/).length <= 4 && value.split(/\s+/).every((part) => isLength(part, true));
  if (/^border(?:-(?:top|bottom)-(?:left|right))?-radius$/.test(property)) {
    const groups = splitTopLevelCss(value, "/");
    return Boolean(
      groups
      && groups.length <= 2
      && groups.every((group) => {
        const radii = splitTopLevelCss(group);
        return radii && radii.length <= 4 && radii.every((part) => isLength(part, false));
      }),
    );
  }
  if (property === "gap" || property === "column-gap") return value.split(/\s+/).length <= 2 && value.split(/\s+/).every((part) => isLength(part, false));
  if (property === "border-width") return value.split(/\s+/).length <= 4 && value.split(/\s+/).every((part) => isLength(part, false));
  if (property === "border-color" || property === "background-color" || property === "color") return isColor(value);
  if (property === "border-style") return /^(?:none|solid|dashed|dotted|double)(?:\s+(?:none|solid|dashed|dotted|double)){0,3}$/i.test(value);
  if (property === "border") return /^(?:0|(?:\d+(?:\.\d+)?px)\s+(?:solid|dashed|dotted|double)\s+(?:#[0-9a-f]{3,8}|transparent|currentcolor))$/i.test(value);
  if (property === "box-shadow") return isSafeShadow(value);
  if (property === "aspect-ratio") return isSafeAspectRatio(value);
  if (property === "column-count") return /^(?:auto|[1-9]|1[0-2])$/i.test(value);
  if (property === "opacity") return /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value);
  if (property === "font-family") return /^var\(--wp--preset--font-family--[a-z0-9-]+\)$/i.test(value);
  if (property === "line-height") return isLength(value, false) || /^(?:normal|[0-9](?:\.\d+)?)$/i.test(value);
  if (property === "letter-spacing") return value === "normal" || isSignedLength(value, false);
  if (property === "font-weight") return /^(?:normal|bold|[1-9]00)$/i.test(value);
  if (property === "font-style") return /^(?:normal|italic|oblique)$/i.test(value);
  if (property === "display") return /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|none)$/i.test(value);
  if (property === "position") return /^(?:static|relative)$/i.test(value);
  if (property === "overflow" || property === "overflow-x" || property === "overflow-y") return /^(?:visible|hidden|clip|auto|scroll)$/i.test(value);
  if (property === "object-fit") return /^(?:fill|contain|cover|none|scale-down)$/i.test(value);
  if (property === "text-align") return /^(?:start|end|left|right|center|justify)$/i.test(value);
  if (property === "text-decoration") return /^(?:none|underline|line-through)$/i.test(value);
  if (property === "text-indent") return isSignedLength(value, true);
  if (property === "text-transform") return /^(?:none|capitalize|uppercase|lowercase)$/i.test(value);
  if (property === "writing-mode") return /^(?:horizontal-tb|vertical-rl|vertical-lr)$/i.test(value);
  if (property === "vertical-align") return /^(?:baseline|sub|super|text-top|text-bottom|middle|top|bottom)$/i.test(value);
  if (property === "align-items") return /^(?:normal|stretch|center|start|end|flex-start|flex-end|baseline)$/i.test(value);
  if (property === "justify-content") return /^(?:normal|center|start|end|flex-start|flex-end|space-between|space-around|space-evenly)$/i.test(value);
  if (property === "flex-direction") return /^(?:row|row-reverse|column|column-reverse)$/i.test(value);
  if (property === "flex-wrap") return /^(?:nowrap|wrap|wrap-reverse)$/i.test(value);
  if (property === "flex-grow" || property === "flex-shrink") return /^(?:0|[1-9]\d?(?:\.\d+)?)$/.test(value);
  if (property === "order") return /^-?\d{1,2}$/.test(value);
  if (property === "flex") return /^(?:none|auto|initial|[0-9](?:\.\d+)?\s+[0-9](?:\.\d+)?\s+(?:auto|0|[0-9.]+(?:px|%|rem|em)))$/i.test(value);
  return false;
}

function isLength(value: string, allowAuto: boolean, isFontSize = false): boolean {
  if (SAFE_CSS_VARIABLE.test(value)) return true;
  if (allowAuto && /^(?:auto|fit-content|max-content|min-content)$/i.test(value)) return true;
  if (/^(?:calc|min|max|clamp)\(/i.test(value)) return isSafeLengthExpression(value);
  const match = value.match(/^(\d+(?:\.\d+)?)(px|pt|pc|rem|em|ex|ch|lh|rlh|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh)?$/i);
  if (!match) return false;
  const amount = Number(match[1]);
  const unit = (match[2] || "").toLowerCase();
  if (!unit) return amount === 0;
  if (unit === "px" || unit === "pt" || unit === "pc") return amount <= 4_096;
  if (unit === "rem" || unit === "em" || unit === "ex" || unit === "ch" || unit === "lh" || unit === "rlh") return amount <= 100;
  return amount <= (isFontSize ? 1_000 : 100);
}

function splitTopLevelCss(value: string, separator?: "/"): string[] | null {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return null;

    const shouldSplit = depth === 0
      && (separator ? character === separator : /\s/.test(character));
    if (shouldSplit) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (depth !== 0) return null;
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : null;
}

function isSafeLengthExpression(value: string): boolean {
  if (value.length > 300 || !/^[a-z0-9\s.%(),+*/_-]+$/i.test(value)) return false;
  const tokens = value.match(
    /var\(--wp--(?:preset|style)--[a-z0-9-]+(?:--[a-z0-9-]+)*\)|(?:calc|min|max|clamp)\(|-?\d+(?:\.\d+)?(?:px|pt|pc|rem|em|ex|ch|lh|rlh|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh)?|[(),+*/-]|\s+/gi,
  );
  if (!tokens || tokens.join("") !== value) return false;

  let depth = 0;
  for (const token of tokens) {
    if (token.endsWith("(")) depth += 1;
    else if (token === "(") depth += 1;
    else if (token === ")") depth -= 1;
    if (depth < 0) return false;

    const numeric = token.match(/^-?(\d+(?:\.\d+)?)([a-z%]+)?$/i);
    if (numeric && Math.abs(Number(numeric[1])) > 4_096) return false;
  }
  return depth === 0;
}

function isSafeBackgroundImage(value: string): boolean {
  if (/^none$/i.test(value)) return true;
  const match = value.match(/^url\(\s*(?:\"([^\"]+)\"|'([^']+)'|([^'\"\s)]+))\s*\)$/i);
  const source = match?.[1] || match?.[2] || match?.[3];
  if (!source || /[\u0000-\u001f\u007f\\]/.test(source)) return false;

  try {
    const url = new URL(source, "https://cms.invalid/");
    return (url.protocol === "https:" || url.protocol === "http:")
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isSafeGradient(value: string): boolean {
  if (
    value.length > 300
    || !/^(?:(?:repeating-)?(?:linear|radial|conic)-gradient)\(/i.test(value)
    || !/^[#(),.%+\-*/\sa-z0-9]+$/i.test(value)
  ) {
    return false;
  }

  const variables = value.match(/var\(([^)]+)\)/gi) || [];
  if (variables.some((variable) => !SAFE_CSS_VARIABLE.test(variable))) return false;

  const functions = value
    .replace(/var\(--wp--(?:preset|style)--[a-z0-9-]+(?:--[a-z0-9-]+)*\)/gi, "")
    .match(/[a-z][a-z0-9-]*(?=\()/gi) || [];
  const safeFunctions = new Set([
    "calc", "color", "color-mix", "conic-gradient", "hsl", "hsla", "hwb", "lab",
    "lch", "linear-gradient", "oklab", "oklch", "radial-gradient", "repeating-conic-gradient",
    "repeating-linear-gradient", "repeating-radial-gradient", "rgb", "rgba",
  ]);
  if (functions.some((name) => !safeFunctions.has(name.toLowerCase()))) return false;

  const topLevelValues = splitTopLevelCss(value);
  return topLevelValues?.length === 1 && topLevelValues[0] === value;
}

function isSafeBackgroundPosition(value: string): boolean {
  const parts = value.split(/\s+/);
  return parts.length <= 4 && parts.every(
    (part) => /^(?:left|center|right|top|bottom)$/i.test(part) || isLength(part, false),
  );
}

function isSignedLength(value: string, allowPercent: boolean): boolean {
  if (SAFE_CSS_VARIABLE.test(value)) return true;
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/i);
  if (!match || (!allowPercent && match[2] === "%")) return false;
  const amount = Math.abs(Number(match[1]));
  const unit = (match[2] || "").toLowerCase();
  if (!unit) return amount === 0;
  if (unit === "px") return amount <= 4_096;
  return amount <= 100;
}

function isSafeAspectRatio(value: string): boolean {
  if (/^auto$/i.test(value)) return true;
  const parts = value.split("/").map((part) => part.trim());
  if (parts.length > 2 || parts.some((part) => !/^\d{1,4}(?:\.\d{1,20})?$/.test(part))) return false;
  return parts.every((part) => {
    const number = Number(part);
    return Number.isFinite(number) && number > 0 && number <= 10_000;
  });
}

function isColor(value: string): boolean {
  if (SAFE_CSS_VARIABLE.test(value)) return true;
  if (/^(?:transparent|currentcolor|black|white)$/i.test(value) || /^#[0-9a-f]{3,8}$/i.test(value)) return true;
  const match = value.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i);
  return Boolean(match && [match[1], match[2], match[3]].every((channel) => Number(channel) <= 255));
}

function isSafeShadow(value: string): boolean {
  if (value === "none") return true;
  if (value.length > 240 || !/^[#(),.%\sa-z0-9-]+$/i.test(value)) return false;
  const colorMatch = value.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\)|currentcolor)\s*$/i);
  if (!colorMatch || !isColor(colorMatch[1])) return false;
  const dimensions = value
    .slice(0, colorMatch.index)
    .replace(/^\s*inset\s+/i, "")
    .trim()
    .split(/\s+/);
  return dimensions.length >= 2
    && dimensions.length <= 4
    && dimensions.every((part) => part === "0" || /^-?\d+(?:\.\d+)?px$/i.test(part))
    && dimensions.every((part) => part === "0" || Math.abs(Number.parseFloat(part)) <= 100);
}

export function sanitizeCmsHtml(html: string): string {
  if (!html) return "";
  html = addDefaultCmsIconDimensions(html);

  if (typeof DOMParser === "undefined") {
    return html
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\2/gi, "")
      .replace(/\s+style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote, value) => {
        const sanitized = sanitizeCmsStyleAttribute(value);
        return sanitized ? ` style=${quote}${sanitized}${quote}` : "";
      })
      .replace(/\s+class\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote, value) => {
        const classes = value.split(/\s+/).filter((className: string) => className && !CMS_GEOMETRY_CLASS.test(className));
        return classes.length ? ` class=${quote}${classes.join(" ")}${quote}` : "";
      })
      .replace(/<(\/?)main\b/gi, "<$1div");
  }

  const parsed = new DOMParser().parseFromString("", "text/html");
  const root = parsed.createElement("div");
  root.innerHTML = html;
  let blockedAttributes = 0;
  let blockedStyleAttributes = 0;

  const images = Array.from(root.querySelectorAll("img"));
  const priorityImage = images.find((image) => {
    const source = image.getAttribute("src")?.trim();
    const width = Number.parseFloat(image.getAttribute("width") || "");
    const height = Number.parseFloat(image.getAttribute("height") || "");
    return Boolean(source)
      && !image.closest("footer")
      && !/\.svg(?:[?#]|$)/i.test(source!)
      && !(width > 0 && height > 0 && width <= 128 && height <= 128);
  }) || images.find((image) => Boolean(image.getAttribute("src")?.trim()) && !image.closest("footer"));
  images.forEach((image) => {
    const source = image.getAttribute("src");
    if (source !== null && !source.trim()) {
      image.remove();
      return;
    }
    const width = Number.parseFloat(image.getAttribute("width") || "");
    const height = Number.parseFloat(image.getAttribute("height") || "");
    const isSmallImage = width > 0 && height > 0 && width <= 128 && height <= 128;
    const optimizedSource = source
      ? netlifyImageUrl(source, isSmallImage ? width : image === priorityImage ? 1280 : 1024)
      : null;
    if (optimizedSource) {
      image.dataset.originalSrc = source!;
      image.setAttribute("src", optimizedSource);
      if (isSmallImage) {
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
      } else {
        image.setAttribute(
          "srcset",
          [480, 768, 1024, 1280, 1600]
            .map((candidateWidth) => `${netlifyImageUrl(source!, candidateWidth)} ${candidateWidth}w`)
            .join(", "),
        );
        if (!image.hasAttribute("sizes")) image.setAttribute("sizes", "100vw");
      }
    }
    if (!image.hasAttribute("alt")) image.setAttribute("alt", "");
    if (image === priorityImage) {
      image.setAttribute("decoding", "sync");
      image.setAttribute("loading", "eager");
      image.setAttribute("fetchpriority", "high");
    } else {
      image.setAttribute("decoding", "async");
      image.setAttribute("loading", "lazy");
      image.removeAttribute("fetchpriority");
    }
  });
  root.querySelectorAll<HTMLElement>("[href], [src]").forEach((element) => {
    for (const attribute of ["href", "src"] as const) {
      const source = element.getAttribute(attribute);
      if (!source) continue;
      const storefrontUrl = storefrontProxiedMediaUrl(source, {
        backendOrigin: BACKEND_ORIGIN,
        baseUrl: window.location.href,
      });
      if (storefrontUrl) element.setAttribute(attribute, storefrontUrl);
    }
  });

  root.querySelectorAll("main").forEach((main) => {
    const replacement = parsed.createElement("div");
    Array.from(main.attributes).forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    replacement.setAttribute("data-funky-cms-wrapper", "true");
    while (main.firstChild) replacement.appendChild(main.firstChild);
    main.replaceWith(replacement);
  });
  root.querySelectorAll("*").forEach((element) => {
    const isShellWrapper = element.hasAttribute("data-funky-cms-wrapper");
    const isGeometryWrapper = isCmsGeometryWrapper(element);
    if (isGeometryWrapper) {
      Array.from(element.classList).forEach((className) => {
        if (
          (CMS_GEOMETRY_CLASS.test(className)
            && (className !== "has-global-padding" || isShellWrapper))
          || CMS_WRAPPER_PADDING_CLASS.test(className)
        ) {
          element.classList.remove(className);
        }

      });
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on")
        || name === "srcdoc"
        || ((name === "href" || name === "src" || name === "xlink:href") && /^(?:javascript|vbscript):/.test(value))
      ) {
        element.removeAttribute(attribute.name);
        blockedAttributes += 1;
      } else if (name === "style") {
        const sanitized = sanitizeCmsStyleAttribute(attribute.value)
          .split("; ")
          .filter((declaration) => !isGeometryWrapper || !/^(?:width|max-width):/.test(declaration))
          .join("; ");
        if (sanitized) element.setAttribute("style", sanitized);
        else element.removeAttribute("style");
        const originalDeclarations = attribute.value.split(";").filter((declaration) => declaration.trim()).length;
        const retainedDeclarations = sanitized.split(";").filter((declaration) => declaration.trim()).length;
        if (retainedDeclarations < originalDeclarations) blockedStyleAttributes += 1;
      }
    }
    if (isShellWrapper) element.removeAttribute("data-funky-cms-wrapper");
  });

  if (blockedAttributes) {
    warnOnce(
      `blocked-markup:${blockedAttributes}`,
      `Blocked ${blockedAttributes} executable CMS attribute(s). Use a Custom HTML JavaScript block instead.`,
    );
  }
  if (blockedStyleAttributes) {
    warnOnce(
      `blocked-styles:${blockedStyleAttributes}`,
      `Blocked unsafe CMS inline styles on ${blockedStyleAttributes} element(s). Only bounded presentation declarations are allowed.`,
    );
  }
  return root.innerHTML;
}

function netlifyImageUrl(source: string, width: number): string | null {
  if (typeof window === "undefined") return null;
  if (!/(?:^|\.)superfunky\.pro$|\.netlify\.app$/i.test(window.location.hostname)) return null;
  let mediaUrl: URL;
  try {
    mediaUrl = new URL(source);
  } catch {
    return null;
  }
  const isWordPressUpload = /^(?:v[0-9]+|dev|blog|shop|sample)\.superfunky\.pro$/i.test(mediaUrl.hostname)
    && mediaUrl.pathname.startsWith("/wp-content/uploads/")
    && /\.(?:avif|jpe?g|png|webp)$/i.test(mediaUrl.pathname);
  const isUnsplashImage = mediaUrl.hostname === "images.unsplash.com"
    && /^\/photo-[a-z0-9-]+$/i.test(mediaUrl.pathname);
  if (!isWordPressUpload && !isUnsplashImage) return null;
  const parameters = new URLSearchParams({
    url: mediaUrl.toString(),
    w: String(Math.max(1, Math.min(1920, Math.round(width)))),
    q: "75",
  });
  return `/.netlify/images?${parameters.toString()}`;
}

function isCmsGeometryWrapper(element: Element): boolean {
  return element.hasAttribute("data-funky-cms-wrapper")
    || element.classList.contains("container");
}

export function mountCmsBehaviors(container: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [mountCmsAutoplayVideos(container), mountCmsImageFallbacks(container)];

  // Lazy-load prismjs only when the container has code blocks — keeps it out of the initial bundle.
  if (container.querySelector("code, pre")) {
    let disposed = false;
    let pendingCleanup: Cleanup | null = null;
    void import("./codeHighlighting.ts").then(({ mountCmsCodeHighlighting }) => {
      if (disposed) return;
      pendingCleanup = mountCmsCodeHighlighting(container);
    });
    cleanups.push(() => {
      disposed = true;
      pendingCleanup?.();
    });
  }
  const requests = new Map<HTMLElement, Set<string>>();

  const addRequest = (element: HTMLElement, id: string) => {
    const ids = requests.get(element) ?? new Set<string>();
    ids.add(id);
    requests.set(element, ids);
  };

  const declarativeElements = [
    ...(container.matches("[data-funky-behavior]") ? [container] : []),
    ...Array.from(container.querySelectorAll<HTMLElement>("[data-funky-behavior]")),
  ];
  declarativeElements.forEach((element) => {
    (element.dataset.funkyBehavior || "").split(/[\s,]+/).filter(Boolean).forEach((id) => addRequest(element, id));
  });

  const knownLegacyShapes: Array<[string, CmsBehaviorId]> = [
    ["#gml-map", "homepage-location"],
    ["#openNewsletterBtn", "homepage-newsletter-trigger"],
    ["#orbital-wrapper", "homepage-orbital"],
  ];
  knownLegacyShapes.forEach(([selector, id]) => {
    container.querySelectorAll<HTMLElement>(selector).forEach((element) => addRequest(element, id));
  });

  const explicitlyRequestsDocs = Array.from(requests.values()).some((ids) => ids.has("docs-navigation"));
  if (
    !explicitlyRequestsDocs
    && container.querySelector("#doc-sidebar")
    && container.querySelector("#docs-content")
    && container.querySelector("#scroll-spy")
  ) {
    addRequest(container, "docs-navigation");
  }

  requests.forEach((ids, element) => {
    ids.forEach((requestedId) => {
      if (!isCmsBehaviorId(requestedId)) {
        warnOnce(
          `unknown-behavior:${requestedId}`,
          `Ignoring unsupported CMS behavior "${requestedId}". Register a bundled behavior before using it in WordPress.`,
        );
        return;
      }

      const mounted = activeMounts.get(element) ?? new Map<CmsBehaviorId, Cleanup>();
      if (mounted.has(requestedId)) return;

      const behaviorCleanup = CMS_BEHAVIOR_REGISTRY[requestedId](element);
      mounted.set(requestedId, behaviorCleanup);
      activeMounts.set(element, mounted);
      cleanups.push(() => {
        if (mounted.get(requestedId) !== behaviorCleanup) return;
        behaviorCleanup();
        mounted.delete(requestedId);
        if (!mounted.size) activeMounts.delete(element);
      });
    });
  });

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}

function mountCmsAutoplayVideos(container: HTMLElement): Cleanup {
  const videos = Array.from(container.querySelectorAll<HTMLVideoElement>("video[autoplay]"));
  if (!videos.length) return () => undefined;

  const listenerCleanups: Cleanup[] = [];
  const resumePlayback = (video: HTMLVideoElement) => {
    if (!video.isConnected || !video.autoplay) return;
    video.muted = true;
    video.playsInline = true;
    if (document.visibilityState === "hidden") return;

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      void playAttempt.catch((error) => {
        const source = video.currentSrc || video.src || "unknown";
        const message = error instanceof Error ? error.message : String(error);
        warnOnce(`autoplay-video:${source}`, `CMS autoplay video could not start (${message}).`);
      });
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") return;
    videos.forEach((video) => resumePlayback(video));
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pageshow", onVisibilityChange);
  listenerCleanups.push(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pageshow", onVisibilityChange);
  });

  videos.forEach((video) => {
    const onCanPlay = () => resumePlayback(video);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onCanPlay);
    listenerCleanups.push(() => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onCanPlay);
    });
  });

  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (!(entry.target instanceof HTMLVideoElement)) return;
        resumePlayback(entry.target);
      });
    }, { rootMargin: "160px 0px" });
    videos.forEach((video) => observer.observe(video));
    listenerCleanups.push(() => observer.disconnect());
  } else {
    videos.forEach((video) => resumePlayback(video));
  }

  return () => listenerCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}

function mountCmsImageFallbacks(container: HTMLElement): Cleanup {
  const handleError = (event: Event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const image = event.target;
    const originalSource = image.dataset.originalSrc;
    if (!originalSource) return;

    delete image.dataset.originalSrc;
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.src = originalSource;
  };

  container.addEventListener("error", handleError, true);
  return () => container.removeEventListener("error", handleError, true);
}

function mountHomepageLocation(container: HTMLElement): Cleanup {
  const originalHtml = container.innerHTML;
  const originalClass = container.className;
  const originalRole = container.getAttribute("role");
  const originalLabel = container.getAttribute("aria-label");
  const panel = document.createElement("div");
  panel.className = "cms-home-location-panel";
  const label = document.createElement("strong");
  label.textContent = "Superfunky";
  const description = document.createElement("span");
  description.textContent = "The e-commerce theme for modern stores";
  const link = document.createElement("a");
  link.href = "https://www.google.com/maps/search/?api=1&query=51.1148990014727%2C17.049323088294965";
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = "View location on Google Maps";
  panel.append(label, description, link);
  container.replaceChildren(panel);
  container.classList.add("cms-home-location");
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", "Superfunky location");

  return () => {
    container.innerHTML = originalHtml;
    container.className = originalClass;
    restoreAttribute(container, "role", originalRole);
    restoreAttribute(container, "aria-label", originalLabel);
  };
}

function mountHomepageNewsletterTrigger(button: HTMLElement): Cleanup {
  const overlay = button.ownerDocument.getElementById("newsletterOverlay");
  const originalHidden = overlay?.hidden;
  const originalAriaHidden = overlay?.getAttribute("aria-hidden") ?? null;
  const originalHasPopup = button.getAttribute("aria-haspopup");
  if (overlay) {
    overlay.hidden = true;
    overlay.classList.add("cms-obsolete-newsletter");
    overlay.setAttribute("aria-hidden", "true");
  }
  button.setAttribute("aria-haspopup", "dialog");

  const openBundledNewsletter = () => {
    if (window.location.hash === "#newsletter") {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = "newsletter";
    }
  };
  button.addEventListener("click", openBundledNewsletter);

  return () => {
    button.removeEventListener("click", openBundledNewsletter);
    restoreAttribute(button, "aria-haspopup", originalHasPopup);
    if (overlay) {
      overlay.classList.remove("cms-obsolete-newsletter");
      overlay.hidden = originalHidden ?? false;
      restoreAttribute(overlay, "aria-hidden", originalAriaHidden);
    }
  };
}

function setSubmissionFormBusy(form: HTMLFormElement, busy: boolean) {
  form.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>("button, input, textarea")
    .forEach((control) => {
      if (control.name === "website") return;
      control.disabled = busy;
    });
}

function mountSubmissionForm(element: HTMLElement): Cleanup {
  if (!(element instanceof HTMLFormElement)) return () => undefined;
  const form = element;
  const status = form.querySelector<HTMLElement>("[data-submission-status]");
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) return;
    const fields: Record<string, string | boolean> = {};
    const files: File[] = [];
    for (const [name, value] of data.entries()) {
      if (name === "website") continue;
      if (value instanceof File) {
        if (value.size) files.push(value);
      } else if (name !== "consent") {
        fields[name.replace(/\[\]$/, "")] = value;
      }
    }
    if (status) status.textContent = "Sending…";
    setSubmissionFormBusy(form, true);
    try {
      await submitFormSubmission({
        formId: form.dataset.formId || "content-form",
        formName: form.dataset.formName,
        email: String(data.get("Email") || data.get("email") || ""),
        source: window.location.href,
        language: document.documentElement.lang,
        fields,
        files,
      });
      form.reset();
      if (status) status.textContent = "Thank you. Your submission was received.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "The form could not be sent.";
    } finally {
      setSubmissionFormBusy(form, false);
    }
  };
  form.addEventListener("submit", submit);
  return () => form.removeEventListener("submit", submit);
}

function mountNewsletterForm(element: HTMLElement): Cleanup {
  if (!(element instanceof HTMLFormElement)) return () => undefined;
  const form = element;
  const status = form.querySelector<HTMLElement>("[data-submission-status]");
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) return;
    const email = String(data.get("email") || "").trim();
    const consent = data.get("consent") === "on";
    if (!consent) {
      if (status) status.textContent = "Please accept the consent note to continue.";
      return;
    }
    if (status) status.textContent = "Subscribing…";
    setSubmissionFormBusy(form, true);
    try {
      await submitNewsletterSubmission(email, {
        source: form.dataset.source || "newsletter-shortcode",
        language: document.documentElement.lang,
        consent,
      });
      form.reset();
      if (status) status.textContent = "Thank you. You are subscribed.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "The signup could not be saved.";
    } finally {
      setSubmissionFormBusy(form, false);
    }
  };
  form.addEventListener("submit", submit);
  return () => form.removeEventListener("submit", submit);
}

function mountHomepageOrbital(container: HTMLElement): Cleanup {
  const tiltClasses = Array.from({ length: 9 }, (_, index) => `cms-orbital-tilt-${Math.floor(index / 3)}-${index % 3}`);
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const updateTilt = (event: PointerEvent) => {
    const x = Math.max(0, Math.min(2, Math.floor((event.clientX / Math.max(1, window.innerWidth)) * 3)));
    const y = Math.max(0, Math.min(2, Math.floor((event.clientY / Math.max(1, window.innerHeight)) * 3)));
    container.classList.remove(...tiltClasses);
    container.classList.add(`cms-orbital-tilt-${y}-${x}`);
  };

  container.classList.add("cms-home-orbital", "cms-orbital-tilt-1-1");
  if (!reduceMotion) window.addEventListener("pointermove", updateTilt);

  return () => {
    window.removeEventListener("pointermove", updateTilt);
    container.classList.remove("cms-home-orbital", ...tiltClasses);
  };
}

function mountDocsNavigation(container: HTMLElement): Cleanup {
  if (
    container.hasAttribute("data-superfunky-docs-page")
    && container.querySelector("[data-doc-article]")
    && container.querySelector("[data-doc-toc-link]")
  ) {
    return mountSuperfunkyDocumentation(container);
  }

  const sidebar = container.querySelector<HTMLElement>("#doc-sidebar");
  const content = container.querySelector<HTMLElement>("#docs-content");
  const spyNav = container.querySelector<HTMLElement>("#scroll-spy ul");
  if (!sidebar || !content || !spyNav) return () => undefined;

  const storageKey = "docs-open-sections";
  const activeHeadingKey = "docs-active-heading";
  const details = Array.from(sidebar.querySelectorAll<HTMLDetailsElement>("details"));
  const detailListeners: Array<[HTMLDetailsElement, EventListener]> = [];
  const spyListeners: Array<[HTMLAnchorElement, EventListener]> = [];
  const generatedAnchors: HTMLAnchorElement[] = [];
  const previousHeaderHeight = document.documentElement.style.getPropertyValue("--header-height");

  let storedOpen: number[] = [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    if (Array.isArray(parsed)) storedOpen = parsed.filter((value): value is number => Number.isInteger(value));
  } catch {
    // Malformed browser storage should not prevent navigation from working.
  }

  details.forEach((detail, index) => {
    detail.open = storedOpen.includes(index);
    const saveOpenDetails = () => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(details.flatMap((item, itemIndex) => item.open ? [itemIndex] : [])));
      } catch {
        // Storage can be unavailable in privacy modes.
      }
    };
    detail.addEventListener("toggle", saveOpenDetails);
    detailListeners.push([detail, saveOpenDetails]);
  });

  const currentPath = location.pathname.replace(/\/$/, "");
  sidebar.querySelectorAll("a").forEach((link) => link.classList.remove("active"));
  details.forEach((detail) => detail.classList.remove("section-active"));
  sidebar.querySelectorAll<HTMLAnchorElement>(".doc-links a").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/\/$/, "");
    if (href && (currentPath === href || currentPath.startsWith(`${href}/`))) {
      link.classList.add("active");
      const parent = link.closest("details");
      if (parent) {
        parent.open = true;
        parent.classList.add("section-active");
      }
    }
  });

  const toggleMobileSidebar = (event: Event) => {
    if ((event.target as Element | null)?.closest("#docs-mobile-toggle")) sidebar.classList.toggle("docs-mobile-open");
  };
  container.addEventListener("click", toggleMobileSidebar);

  const syncHeaderHeight = () => {
    const header = document.getElementById("main-header");
    if (header) document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height + 20}px`);
  };
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  spyNav.replaceChildren();
  const usedSlugs = new Map<string, number>();
  const items = Array.from(content.querySelectorAll<HTMLElement>("h2, h3, h4, h5, h6")).map((heading) => {
    if (!heading.id) {
      const base = slugify(heading.textContent || "") || "section";
      const count = (usedSlugs.get(base) || 0) + 1;
      usedSlugs.set(base, count);
      heading.id = count === 1 ? base : `${base}-${count}`;
    }

    if (!heading.querySelector(":scope > .heading-anchor")) {
      const anchor = document.createElement("a");
      anchor.href = `#${heading.id}`;
      anchor.className = "heading-anchor";
      anchor.setAttribute("aria-label", `Link to ${heading.textContent?.trim() || "section"}`);
      anchor.textContent = "#";
      heading.prepend(anchor);
      generatedAnchors.push(anchor);
    }

    const listItem = document.createElement("li");
    listItem.className = `spy-item level-${heading.tagName.slice(1)}`;
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent?.replace(/^#/, "").trim() || heading.id;
    link.className = "spy-link";
    const scrollToHeading = (event: Event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    link.addEventListener("click", scrollToHeading);
    spyListeners.push([link, scrollToHeading]);
    listItem.appendChild(link);
    spyNav.appendChild(listItem);
    return { heading, link };
  });

  let observer: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const active = items.find(({ heading }) => heading === entry.target);
        if (!active) return;
        items.forEach((item) => {
          item.link.classList.toggle("active", item === active);
          item.heading.classList.toggle("heading-active", item === active);
        });
        try {
          sessionStorage.setItem(activeHeadingKey, active.heading.id);
        } catch {
          // Storage is optional.
        }
      });
    }, { rootMargin: "0px 0px -65% 0px", threshold: 0.1 });
    items.forEach(({ heading }) => observer?.observe(heading));
  }

  return () => {
    observer?.disconnect();
    window.removeEventListener("resize", syncHeaderHeight);
    container.removeEventListener("click", toggleMobileSidebar);
    detailListeners.forEach(([detail, listener]) => detail.removeEventListener("toggle", listener));
    spyListeners.forEach(([link, listener]) => link.removeEventListener("click", listener));
    generatedAnchors.forEach((anchor) => anchor.remove());
    spyNav.replaceChildren();
    sidebar.classList.remove("docs-mobile-open");
    if (previousHeaderHeight) document.documentElement.style.setProperty("--header-height", previousHeaderHeight);
    else document.documentElement.style.removeProperty("--header-height");
  };
}

function mountSuperfunkyDocumentation(container: HTMLElement): Cleanup {
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("[data-doc-toc-link]"));
  const headings = links.flatMap((link) => {
    const id = decodeURIComponent(link.hash.slice(1));
    const heading = Array.from(container.querySelectorAll<HTMLElement>("[data-doc-article] h2, [data-doc-article] h3"))
      .find((candidate) => candidate.id === id);
    return heading ? [{ heading, link }] : [];
  });
  if (!headings.length) return () => undefined;

  const initialState = links.map((link) => ({
    active: link.getAttribute("data-active"),
    current: link.getAttribute("aria-current"),
  }));
  const setActive = (id: string) => {
    links.forEach((link) => {
      const active = decodeURIComponent(link.hash.slice(1)) === id;
      link.dataset.active = String(active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  const update = () => {
    const viewportHeight = window.innerHeight;
    const focusLine = Math.min(Math.max(viewportHeight * 0.15, 112), 160);
    const positions = headings.map(({ heading }) => ({
      heading,
      top: heading.getBoundingClientRect().top,
      bottom: heading.getBoundingClientRect().bottom,
    }));
    const visible = positions.filter(({ top, bottom }) => bottom > 0 && top < viewportHeight);
    const passedFocus = visible.filter(({ top }) => top <= focusLine);
    const active = passedFocus.at(-1)?.heading
      || visible[0]?.heading
      || positions.filter(({ top }) => top <= focusLine).at(-1)?.heading
      || headings[0].heading;
    setActive(active.id);
  };

  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", update);
  update();

  return () => {
    window.removeEventListener("scroll", update);
    document.removeEventListener("scroll", update, { capture: true });
    window.removeEventListener("resize", update);
    window.removeEventListener("hashchange", update);
    links.forEach((link, index) => {
      restoreAttribute(link, "data-active", initialState[index].active);
      restoreAttribute(link, "aria-current", initialState[index].current);
    });
  };
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function isCmsBehaviorId(value: string): value is CmsBehaviorId {
  return Object.prototype.hasOwnProperty.call(CMS_BEHAVIOR_REGISTRY, value);
}

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[CMS content] ${message}`);
}

export const CMS_BEHAVIOR_REGISTRY = {
  "docs-navigation": mountDocsNavigation,
  "homepage-location": mountHomepageLocation,
  "homepage-newsletter-trigger": mountHomepageNewsletterTrigger,
  "homepage-orbital": mountHomepageOrbital,
  "homepage-terminal": () => () => undefined,
  "newsletter-form": mountNewsletterForm,
  "submission-form": mountSubmissionForm,
} satisfies Record<string, BehaviorMount>;
