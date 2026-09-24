import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import tailwindcss from "tailwindcss";

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

export function cssClassNames(css) {
  const classes = new Set();
  postcss.parse(css).walkRules((rule) => {
    selectorParser((selectors) => {
      selectors.walkClasses(({ value }) => classes.add(value));
    }).processSync(rule.selector);
  });
  return classes;
}

export async function compileCmsTailwindClasses(config) {
  const candidates = CMS_TAILWIND_STABLE_UTILITIES;
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: "", extension: "html" }], safelist: candidates }),
  ]).process("@tailwind components;\n@tailwind utilities;", { from: undefined });
  const cssBytes = Buffer.byteLength(result.css);
  if (cssBytes > MAX_CSS_BYTES) throw new Error(`CMS Tailwind CSS exceeds the ${MAX_CSS_BYTES} byte limit.`);
  const generated = cssClassNames(result.css);
  const classes = candidates.filter((token) => generated.has(token));
  return { classes, rejected: [], cssBytes, candidateCount: candidates.length };
}

export function buildTailwindContentSource(classes) {
  return [
    "<!-- Generated stable CMS Tailwind contract. Do not edit. -->",
    `<div class="${classes.join(" ")}"></div>`,
    "",
  ].join("\n");
}
