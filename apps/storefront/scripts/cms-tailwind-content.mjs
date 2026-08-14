const MAX_CLASS_TOKEN_LENGTH = 160;
const MAX_CLASS_COUNT = 5_000;

const ALLOWED_VARIANTS = new Set([
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "dark",
  "hover",
  "focus",
  "focus-within",
  "focus-visible",
  "active",
  "disabled",
  "visited",
  "checked",
  "first",
  "last",
  "only",
  "odd",
  "even",
  "required",
  "invalid",
  "read-only",
  "open",
  "group-hover",
  "group-focus",
  "peer-hover",
  "peer-focus",
  "peer-checked",
  "peer-disabled",
  "motion-safe",
  "motion-reduce",
  "portrait",
  "landscape",
  "print",
]);

const EXACT_UTILITIES = new Set([
  "absolute",
  "block",
  "container",
  "contents",
  "fixed",
  "flex",
  "grid",
  "hidden",
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "relative",
  "sr-only",
  "static",
  "sticky",
  "table",
]);

const UTILITY_FAMILIES = [
  "accent", "align", "animate", "appearance", "aspect", "backdrop-blur", "backdrop-brightness",
  "backdrop-contrast", "backdrop-grayscale", "backdrop-hue-rotate", "backdrop-invert",
  "backdrop-opacity", "backdrop-saturate", "backdrop-sepia", "basis", "bg", "blur", "border",
  "bottom", "box", "break", "brightness", "caret", "clear", "col", "columns", "content", "cursor",
  "decoration", "delay", "divide", "drop-shadow", "duration", "ease", "fill", "flex", "float",
  "font", "from", "gap", "grayscale", "grid", "grow", "h", "hue-rotate", "indent", "inset",
  "invert", "isolate", "items", "justify", "leading", "left", "line-clamp", "list", "m", "max-h",
  "max-w", "mb", "min-h", "min-w", "mix-blend", "ml", "mr", "mt", "mx", "my", "object",
  "opacity", "order", "origin", "outline", "overflow", "overscroll", "p", "pb", "placeholder",
  "pl", "pointer-events", "pr", "pt", "px", "py", "resize", "right", "ring", "rotate", "rounded",
  "row", "saturate", "scale", "scroll", "select", "sepia", "shadow", "shrink", "size", "skew",
  "snap", "space", "stroke", "table", "text", "to", "top", "touch", "tracking", "transition",
  "translate", "truncate", "underline", "uppercase", "via", "visible", "w", "whitespace", "will-change",
  "z",
].sort((left, right) => right.length - left.length);

const SIMPLE_UTILITY = /^!?-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\/(?:\d{1,3}|\d+))?$/;
const ARBITRARY_PATTERNS = [
  /^(?:bg|border|caret|decoration|fill|placeholder|stroke|text)-\[#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\](?:\/(?:100|\d{1,2}))?$/,
  /^(?:bottom|gap|h|inset|left|m|mb|min-h|min-w|ml|mr|mt|mx|my|p|pb|pl|pr|pt|px|py|right|top|w|max-h|max-w)-\[-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|ch)\]$/,
  /^rounded(?:-[trbl]{1,2})?-\[\d+(?:\.\d+)?(?:px|rem|em|%)\]$/,
  /^opacity-\[(?:0(?:\.\d+)?|1(?:\.0+)?)\]$/,
  /^(?:order|z)-\[-?\d{1,4}\]$/,
  /^aspect-\[\d{1,4}\/\d{1,4}\]$/,
];

export const CMS_TAILWIND_BASELINE = [
  "block",
  "flex",
  "grid",
  "hidden",
  "mx-auto",
  "text-left",
  "text-center",
  "text-right",
  "font-normal",
  "font-medium",
  "font-semibold",
  "font-bold",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "leading-tight",
  "leading-normal",
  "leading-relaxed",
  "p-2",
  "p-4",
  "p-6",
  "p-8",
  "rounded-lg",
  "md:grid-cols-2",
  "lg:grid-cols-3",
  "bg-white",
  "text-zinc-900",
  "dark:bg-zinc-900",
  "dark:text-zinc-100",
];

function expand(prefixes, values) {
  return prefixes.flatMap((prefix) => values.map((value) => `${prefix}-${value}`));
}

const SPACING = ["0", "1", "2", "3", "4", "6", "8", "12", "16", "24"];
const COLOR_NAMES = [
  "brand", "zinc", "gray", "red", "amber", "emerald", "cyan", "blue", "violet", "rose",
];
const COLOR_STEPS = ["100", "300", "500", "700", "900"];
const COLORS = COLOR_NAMES.flatMap((name) => COLOR_STEPS.map((step) => `${name}-${step}`));
const COLOR_UTILITIES = [
  "bg-black", "bg-transparent", "bg-white", "border-black", "border-transparent", "border-white",
  "text-black", "text-transparent", "text-white",
  ...expand(["bg", "border", "text"], COLORS),
];
const RESPONSIVE_UTILITIES = [
  ...EXACT_UTILITIES,
  ...expand(["gap", "m", "mb", "ml", "mr", "mt", "mx", "my", "p", "pb", "pl", "pr", "pt", "px", "py"], SPACING),
  ...expand(["grid-cols"], ["1", "2", "3", "4", "5", "6", "12", "none"]),
  ...expand(["col-span"], ["1", "2", "3", "4", "5", "6", "12", "full"]),
  ...expand(["items"], ["start", "center", "end", "stretch", "baseline"]),
  ...expand(["justify"], ["start", "center", "end", "between", "around", "evenly"]),
  ...expand(["text"], ["left", "center", "right", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]),
  ...expand(["w", "h"], ["auto", "full", "screen", "min", "max", "fit"]),
];
const INTERACTIVE_COLOR_UTILITIES = COLOR_UTILITIES.filter((utility) =>
  /^(?:bg|text)-(?:black|white|[a-z]+-(?:500|700))$/.test(utility));

export const CMS_TAILWIND_STABLE_UTILITIES = [
  ...new Set([
    ...CMS_TAILWIND_BASELINE,
    ...RESPONSIVE_UTILITIES,
    ...COLOR_UTILITIES,
    ...expand(["border"], ["0", "2", "4", "8"]),
    ...expand(["font"], ["normal", "medium", "semibold", "bold"]),
    ...expand(["leading"], ["none", "tight", "snug", "normal", "relaxed", "loose"]),
    ...expand(["opacity"], ["0", "25", "50", "75", "100"]),
    ...expand(["rounded"], ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]),
    ...expand(["shadow"], ["sm", "md", "lg", "xl", "2xl", "none"]),
    ...["sm", "md", "lg", "xl", "2xl"].flatMap((variant) =>
      RESPONSIVE_UTILITIES.map((utility) => `${variant}:${utility}`)),
    ...COLOR_UTILITIES.map((utility) => `dark:${utility}`),
    ...["hover", "focus"].flatMap((variant) =>
      INTERACTIVE_COLOR_UTILITIES.map((utility) => `${variant}:${utility}`)),
  ]),
].sort();

const STABLE_UTILITY_SET = new Set(CMS_TAILWIND_STABLE_UTILITIES);
const DYNAMIC_VARIANTS = new Set([
  "sm", "md", "lg", "xl", "2xl", "dark", "hover", "focus", "focus-within",
  "focus-visible", "active", "disabled", "visited", "checked", "required",
  "invalid", "read-only", "open", "portrait", "landscape", "motion-safe",
  "motion-reduce", "print",
]);

function utilityFamily(base) {
  const normalized = base.replace(/^!/, "").replace(/^-/, "");
  return UTILITY_FAMILIES.find((family) => normalized === family || normalized.startsWith(`${family}-`));
}

function splitVariants(token) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "[") depth += 1;
    if (token[index] === "]") {
      depth -= 1;
      if (depth < 0) return null;
    }
    if (token[index] === ":" && depth === 0) {
      parts.push(token.slice(start, index));
      start = index + 1;
    }
  }
  if (depth !== 0) return null;
  parts.push(token.slice(start));
  return parts;
}

export function evaluateCmsClassToken(token) {
  if (!token || token.length > MAX_CLASS_TOKEN_LENGTH) {
    return { status: "rejected", reason: `tokens must contain 1-${MAX_CLASS_TOKEN_LENGTH} characters` };
  }
  if (!/^[\x21-\x7e]+$/.test(token) || /[<>{};"'`\\]/.test(token)) {
    return { status: "rejected", reason: "token contains unsafe or unsupported characters" };
  }

  const parts = splitVariants(token);
  if (!parts || parts.some((part) => !part)) {
    return { status: "rejected", reason: "token has malformed variant or bracket syntax" };
  }
  const base = parts.at(-1);
  const variants = parts.slice(0, -1);
  if (variants.some((variant) => !ALLOWED_VARIANTS.has(variant))) {
    return { status: "rejected", reason: "token uses a variant that is not allowlisted" };
  }

  const normalizedBase = base.replace(/^!/, "").replace(/^-/, "");
  const family = utilityFamily(base);
  if (!family && !EXACT_UTILITIES.has(normalizedBase)) return { status: "ignored" };

  if (base.includes("[") || base.includes("]")) {
    if (base.startsWith("!")) {
      return { status: "rejected", reason: "important arbitrary utilities are not supported" };
    }
    if (!ARBITRARY_PATTERNS.some((pattern) => pattern.test(normalizedBase))) {
      return { status: "rejected", reason: "arbitrary value is outside the finite allowlist" };
    }
    if (variants.some((variant) => !DYNAMIC_VARIANTS.has(variant))) {
      return { status: "rejected", reason: "arbitrary utility variant cannot be compiled into route CSS" };
    }
    return { status: "dynamic" };
  }

  if (!SIMPLE_UTILITY.test(base)) {
    return { status: "rejected", reason: "token is not a well-formed Tailwind utility" };
  }
  if (!STABLE_UTILITY_SET.has(token)) {
    return { status: "rejected", reason: "utility is outside the stable CMS contract" };
  }
  return { status: "accepted" };
}

function decodeClassAttribute(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&colon;", ":")
    .replaceAll("&sol;", "/")
    .replaceAll("&num;", "#")
    .replaceAll("&percnt;", "%")
    .replaceAll("&lbrack;", "[")
    .replaceAll("&rbrack;", "]")
    .replaceAll("&amp;", "&");
}

export function extractHtmlClassTokens(html) {
  if (typeof html !== "string" || !html) return [];
  const tokens = [];
  for (const match of html.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/gis)) {
    tokens.push(...decodeClassAttribute(match[2]).split(/\s+/).filter(Boolean));
  }
  return tokens;
}

export function collectCmsTailwindClasses(documents) {
  const classes = new Set(CMS_TAILWIND_STABLE_UTILITIES);
  const dynamic = new Set();
  const rejected = new Map();

  for (const document of documents) {
    for (const token of extractHtmlClassTokens(document)) {
      const evaluation = evaluateCmsClassToken(token);
      if (evaluation.status === "accepted") classes.add(token);
      if (evaluation.status === "dynamic") dynamic.add(token);
      if (evaluation.status === "rejected") rejected.set(token, evaluation.reason);
      if (classes.size > MAX_CLASS_COUNT) {
        throw new Error(`CMS Tailwind class limit exceeded (${MAX_CLASS_COUNT}). Reduce the utility set before rebuilding.`);
      }
    }
  }

  return {
    classes: [...classes].sort(),
    dynamic: [...dynamic].sort(),
    rejected: [...rejected].map(([token, reason]) => ({ token, reason })),
  };
}

export function buildTailwindContentSource(classes) {
  return [
    "<!-- Generated stable CMS Tailwind contract. Do not edit. -->",
    `<div class="${classes.join(" ")}"></div>`,
    "",
  ].join("\n");
}
