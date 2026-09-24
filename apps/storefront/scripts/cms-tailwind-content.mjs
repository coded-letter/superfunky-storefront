import { JSDOM } from "jsdom";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import tailwindcss from "tailwindcss";

const MAX_CLASS_TOKEN_LENGTH = 512;
const MAX_CLASS_COUNT = 10_000;
const MAX_CSS_BYTES = 1_000_000;

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

function utilityFamily(base) {
  const normalized = base.replace(/^!/, "").replace(/^-/, "").replace("=[", "-[");
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
  if (variants.some((variant) => variant.includes("["))) {
    return { status: "rejected", reason: "arbitrary selectors and variants are not supported in CMS content" };
  }
  if (/^!?\[/.test(base) || /(?:url|image|image-set|cross-fade|element|paint|expression|attr)\(/i.test(base)
    || /(?:javascript|data|https?):/i.test(base) || base.includes("/*") || base.includes("*/")) {
    return { status: "rejected", reason: "URLs, arbitrary declarations and resource-loading values are not supported" };
  }
  // Tailwind, rather than a second utility grammar, decides which safe candidates exist.
  return { status: "accepted" };
}

export function extractHtmlClassTokens(html) {
  if (typeof html !== "string" || !html) return [];
  return [...JSDOM.fragment(html).querySelectorAll("[class]")]
    .flatMap((element) => [...element.classList]);
}

export function collectCmsTailwindClasses(documents) {
  const classes = new Set(CMS_TAILWIND_STABLE_UTILITIES);
  const sources = new Map();
  const rejected = new Map();

  for (const [index, document] of documents.entries()) {
    const html = typeof document === "string" ? document : document.html;
    const source = typeof document === "string" ? `document ${index + 1}` : document.source;
    for (const token of extractHtmlClassTokens(html)) {
      if (!sources.has(token)) sources.set(token, source);
      const evaluation = evaluateCmsClassToken(token);
      if (evaluation.status === "accepted") classes.add(token);
      if (evaluation.status === "rejected") rejected.set(token, { token, reason: evaluation.reason, source });
      if (sources.size + CMS_TAILWIND_STABLE_UTILITIES.length > MAX_CLASS_COUNT) {
        throw new Error(`CMS Tailwind class limit exceeded (${MAX_CLASS_COUNT}). Reduce the utility set before rebuilding.`);
      }
    }
  }

  return {
    classes: [...classes].sort(),
    sources,
    rejected: [...rejected.values()],
  };
}

export function cssClassNames(css) {
  const classes = new Set();
  postcss.parse(css).walkRules((rule) => {
    selectorParser((selectors) => {
      selectors.walkClasses(({ value }) => classes.add(value));
    }).processSync(rule.selector);
  });
  return classes;
}

export async function compileCmsTailwindClasses(documents, config) {
  const { classes: candidates, sources, rejected } = collectCmsTailwindClasses(documents);
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: "", extension: "html" }], safelist: candidates }),
  ]).process("@tailwind components;\n@tailwind utilities;", { from: undefined });
  const cssBytes = Buffer.byteLength(result.css);
  if (cssBytes > MAX_CSS_BYTES) throw new Error(`CMS Tailwind CSS exceeds the ${MAX_CSS_BYTES} byte limit.`);
  const generated = cssClassNames(result.css);
  const classes = candidates.filter((token) => generated.has(token));
  for (const token of candidates) {
    if (generated.has(token) || !sources.has(token)) continue;
    const base = splitVariants(token)?.at(-1) || token;
    if (utilityFamily(base) || token.includes(":") || token.includes("[")) {
      rejected.push({ token, source: sources.get(token), reason: "Tailwind did not generate a utility for this token" });
    }
  }
  return { classes, rejected, cssBytes, candidateCount: candidates.length };
}

export function buildTailwindContentSource(classes) {
  return [
    "<!-- Generated stable CMS Tailwind contract. Do not edit. -->",
    `<div class="${classes.join(" ")}"></div>`,
    "",
  ].join("\n");
}
