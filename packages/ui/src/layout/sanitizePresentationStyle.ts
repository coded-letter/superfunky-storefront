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

  if (property === "background") return isColor(value) || isSafeGradient(value);
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
  if (/^[a-z]{1,30}$/i.test(value) || /^#[0-9a-f]{3,8}$/i.test(value)) return true;
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
