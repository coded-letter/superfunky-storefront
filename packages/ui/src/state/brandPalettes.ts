/**
 * Alternate brand-color palettes for the Layout Studio's "Color palette" section — this
 * is what makes that section actually *drive* the theme rather than just document it.
 * Each preset supplies the full 50–950 scale (mirrors `tailwind.config.ts`'s `brand`
 * color, which reads from CSS custom properties rather than hardcoded hex) plus the two
 * gradient stop colors used by the `brand-gradient`/`brand-gradient-soft` utilities.
 * Selecting a preset writes its colors onto `document.documentElement` as CSS variables
 * (see `applyBrandPalette` below), so every `bg-brand-500`, `text-brand-600`,
 * `bg-brand-gradient`, `shadow-glow`, etc. across the whole site repaints instantly —
 * no rebuild required, same mechanism as the theme max-width preference.
 *
 * 20 curated presets are provided, spanning cool/warm, vivid/muted, and light/dark moods
 * so almost any brand identity has a close starting point. A separate `BrandGradientStyle`
 * axis ("gradient" vs "flat") controls whether the two-stop gradient tokens render as an
 * actual gradient or collapse to a single flat brand color — see `applyBrandPalette`.
 */
export type BrandColorStep = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950";

export type BrandPaletteId =
  | "violet"
  | "sunset"
  | "ocean"
  | "forest"
  | "rose"
  | "indigo"
  | "coral"
  | "teal"
  | "amber"
  | "berry"
  | "slate"
  | "mint"
  | "plum"
  | "citrus"
  | "sky"
  | "ember"
  | "lagoon"
  | "blush"
  | "olive"
  | "midnight";

/** Whether `brand-gradient`/`brand-gradient-soft` render as an actual two-tone
 * gradient (default) or a single flat brand color — see `applyBrandPalette`. */
export type BrandGradientStyle = "gradient" | "flat";

export const BRAND_GRADIENT_STYLE_OPTIONS: { value: BrandGradientStyle; label: string }[] = [
  { value: "gradient", label: "Gradient" },
  { value: "flat", label: "Flat" },
];

export type BrandPalette = {
  label: string;
  /** Short description of the mood/use-case for this preset. */
  description: string;
  scale: Record<BrandColorStep, string>;
  gradientFrom: string;
  gradientTo: string;
};

export const BRAND_COLOR_STEPS: BrandColorStep[] = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export const BRAND_PALETTES: Record<BrandPaletteId, BrandPalette> = {
  violet: {
    label: "Violet (default)",
    description: "The theme's original purple-to-pink identity.",
    scale: {
      "50": "#f4f2ff",
      "100": "#ebe7ff",
      "200": "#d7cfff",
      "300": "#b9a8ff",
      "400": "#9678ff",
      "500": "#7c4dff",
      "600": "#6c2bf2",
      "700": "#5c1fd1",
      "800": "#4b1ba8",
      "900": "#3e1a86",
      "950": "#250f59",
    },
    gradientFrom: "#7c4dff",
    gradientTo: "#ff6bd6",
  },
  sunset: {
    label: "Sunset",
    description: "Warm amber-to-pink — energetic, retail-sale energy.",
    scale: {
      "50": "#fff7ed",
      "100": "#ffedd5",
      "200": "#fed7aa",
      "300": "#fdba74",
      "400": "#fb923c",
      "500": "#f97316",
      "600": "#ea580c",
      "700": "#c2410c",
      "800": "#9a3412",
      "900": "#7c2d12",
      "950": "#431407",
    },
    gradientFrom: "#f97316",
    gradientTo: "#ec4899",
  },
  ocean: {
    label: "Ocean",
    description: "Cool sky-to-cyan — calmer, tech/lifestyle feel.",
    scale: {
      "50": "#f0f9ff",
      "100": "#e0f2fe",
      "200": "#bae6fd",
      "300": "#7dd3fc",
      "400": "#38bdf8",
      "500": "#0ea5e9",
      "600": "#0284c7",
      "700": "#0369a1",
      "800": "#075985",
      "900": "#0c4a6e",
      "950": "#082f49",
    },
    gradientFrom: "#0ea5e9",
    gradientTo: "#22d3ee",
  },
  forest: {
    label: "Forest",
    description: "Emerald-to-lime — natural, sustainable/organic brands.",
    scale: {
      "50": "#ecfdf5",
      "100": "#d1fae5",
      "200": "#a7f3d0",
      "300": "#6ee7b7",
      "400": "#34d399",
      "500": "#10b981",
      "600": "#059669",
      "700": "#047857",
      "800": "#065f46",
      "900": "#064e3b",
      "950": "#022c22",
    },
    gradientFrom: "#10b981",
    gradientTo: "#84cc16",
  },
  rose: {
    label: "Rose",
    description: "Rose-to-amber — bold, beauty/fashion-forward.",
    scale: {
      "50": "#fff1f2",
      "100": "#ffe4e6",
      "200": "#fecdd3",
      "300": "#fda4af",
      "400": "#fb7185",
      "500": "#f43f5e",
      "600": "#e11d48",
      "700": "#be123c",
      "800": "#9f1239",
      "900": "#881337",
      "950": "#4c0519",
    },
    gradientFrom: "#f43f5e",
    gradientTo: "#fb923c",
  },
  indigo: {
    label: "Indigo",
    description: "Deep blue-violet — confident, tech/SaaS-grade.",
    scale: {
      "50": "#f3f2fd",
      "100": "#e2e0fb",
      "200": "#c1bcf5",
      "300": "#938bee",
      "400": "#6255e7",
      "500": "#3829e0",
      "600": "#2a1cc4",
      "700": "#2217a1",
      "800": "#1c1281",
      "900": "#160f67",
      "950": "#0d093e",
    },
    gradientFrom: "#3829e0",
    gradientTo: "#af2fda",
  },
  coral: {
    label: "Coral",
    description: "Warm coral-to-pink — playful, friendly retail.",
    scale: {
      "50": "#fef3f1",
      "100": "#fce2de",
      "200": "#f9c1b8",
      "300": "#f59384",
      "400": "#f0624c",
      "500": "#ed381d",
      "600": "#d02a11",
      "700": "#aa230e",
      "800": "#891c0b",
      "900": "#6d1609",
      "950": "#420d05",
    },
    gradientFrom: "#ed381d",
    gradientTo: "#e02975",
  },
  teal: {
    label: "Teal",
    description: "Teal-to-cyan — fresh, spa & wellness.",
    scale: {
      "50": "#f3fcfb",
      "100": "#e2f8f6",
      "200": "#c1f0ec",
      "300": "#94e6de",
      "400": "#62dace",
      "500": "#39d0c1",
      "600": "#2bb6a8",
      "700": "#239589",
      "800": "#1c786f",
      "900": "#165f58",
      "950": "#0e3a35",
    },
    gradientFrom: "#39d0c1",
    gradientTo: "#29c2e0",
  },
  amber: {
    label: "Amber",
    description: "Golden amber-to-orange — warm, artisanal luxury.",
    scale: {
      "50": "#fef9f0",
      "100": "#fdf1dd",
      "200": "#fbe2b6",
      "300": "#f8cd81",
      "400": "#f5b547",
      "500": "#f3a216",
      "600": "#d58b0b",
      "700": "#ae7209",
      "800": "#8d5c07",
      "900": "#6f4906",
      "950": "#442c04",
    },
    gradientFrom: "#f3a216",
    gradientTo: "#f36f16",
  },
  berry: {
    label: "Berry",
    description: "Deep magenta-to-purple — bold, fashion-forward.",
    scale: {
      "50": "#fdf2f9",
      "100": "#fae1f1",
      "200": "#f4bee2",
      "300": "#eb8ecc",
      "400": "#e25ab5",
      "500": "#da2fa1",
      "600": "#bf228a",
      "700": "#9c1c71",
      "800": "#7e165b",
      "900": "#641248",
      "950": "#3d0b2c",
    },
    gradientFrom: "#da2fa1",
    gradientTo: "#7f35d4",
  },
  slate: {
    label: "Slate",
    description: "Cool graphite-blue — minimal, neutral, editorial.",
    scale: {
      "50": "#f9fafb",
      "100": "#f1f3f6",
      "200": "#eaecf0",
      "300": "#c9ced9",
      "400": "#a5adc0",
      "500": "#8792ab",
      "600": "#6f7c9b",
      "700": "#5c6884",
      "800": "#4d586f",
      "900": "#41495d",
      "950": "#2e3442",
    },
    gradientFrom: "#8792ab",
    gradientTo: "#758bbd",
  },
  mint: {
    label: "Mint",
    description: "Mint-to-teal — clean, eco & organic.",
    scale: {
      "50": "#f3fcf8",
      "100": "#e3f7f0",
      "200": "#c4eede",
      "300": "#98e1c6",
      "400": "#69d3ac",
      "500": "#41c897",
      "600": "#32ae81",
      "700": "#298e69",
      "800": "#217355",
      "900": "#1a5b43",
      "950": "#103729",
    },
    gradientFrom: "#41c897",
    gradientTo: "#3bc9ce",
  },
  plum: {
    label: "Plum",
    description: "Plum-to-rose — elegant, refined evening feel.",
    scale: {
      "50": "#fbf4fb",
      "100": "#f5e5f5",
      "200": "#eac8ea",
      "300": "#db9fdb",
      "400": "#ca72ca",
      "500": "#bc4ebc",
      "600": "#a33ea3",
      "700": "#853285",
      "800": "#6b296b",
      "900": "#552055",
      "950": "#341434",
    },
    gradientFrom: "#bc4ebc",
    gradientTo: "#ce3b6c",
  },
  citrus: {
    label: "Citrus",
    description: "Lime-to-yellow — energetic, fresh & zesty.",
    scale: {
      "50": "#f8fcf2",
      "100": "#eff9e2",
      "200": "#def2c0",
      "300": "#c5e892",
      "400": "#abdd5f",
      "500": "#95d435",
      "600": "#7fb927",
      "700": "#689720",
      "800": "#547a1a",
      "900": "#426115",
      "950": "#283b0c",
    },
    gradientFrom: "#95d435",
    gradientTo: "#edd11d",
  },
  sky: {
    label: "Sky",
    description: "Airy sky-blue-to-indigo — light, open, trustworthy.",
    scale: {
      "50": "#f1f9fe",
      "100": "#def0fc",
      "200": "#b8dff9",
      "300": "#84c8f5",
      "400": "#4caff0",
      "500": "#1d99ed",
      "600": "#1183d0",
      "700": "#0e6baa",
      "800": "#0b5789",
      "900": "#09456d",
      "950": "#052a42",
    },
    gradientFrom: "#1d99ed",
    gradientTo: "#2938e0",
  },
  ember: {
    label: "Ember",
    description: "Red-to-orange — bold urgency, flash-sale energy.",
    scale: {
      "50": "#fdf1f2",
      "100": "#fbdfe1",
      "200": "#f7bbbf",
      "300": "#f08990",
      "400": "#ea535d",
      "500": "#e42532",
      "600": "#c81924",
      "700": "#a3141e",
      "800": "#841018",
      "900": "#680d13",
      "950": "#40080c",
    },
    gradientFrom: "#e42532",
    gradientTo: "#f37616",
  },
  lagoon: {
    label: "Lagoon",
    description: "Turquoise-to-blue — tropical, resort-fresh.",
    scale: {
      "50": "#f2fbfc",
      "100": "#e2f6f9",
      "200": "#c0edf2",
      "300": "#92dfe8",
      "400": "#5fd0dd",
      "500": "#35c4d4",
      "600": "#27abb9",
      "700": "#208c97",
      "800": "#1a707a",
      "900": "#155961",
      "950": "#0c363b",
    },
    gradientFrom: "#35c4d4",
    gradientTo: "#2978e0",
  },
  blush: {
    label: "Blush",
    description: "Soft pink-to-peach — gentle, beauty-forward.",
    scale: {
      "50": "#fdf7f8",
      "100": "#fbeef1",
      "200": "#f5dbe2",
      "300": "#e8b0be",
      "400": "#da8197",
      "500": "#cf5976",
      "600": "#c6395c",
      "700": "#a6304e",
      "800": "#8a2841",
      "900": "#732136",
      "950": "#4f1725",
    },
    gradientFrom: "#cf5976",
    gradientTo: "#d47e54",
  },
  olive: {
    label: "Olive",
    description: "Olive-to-gold — earthy, artisanal & grounded.",
    scale: {
      "50": "#f9faf4",
      "100": "#f0f4e6",
      "200": "#dfe8c9",
      "300": "#c7d7a2",
      "400": "#aec577",
      "500": "#98b654",
      "600": "#829d43",
      "700": "#6a8137",
      "800": "#56682c",
      "900": "#445223",
      "950": "#293215",
    },
    gradientFrom: "#98b654",
    gradientTo: "#d4ac35",
  },
  midnight: {
    label: "Midnight",
    description: "Deep navy-to-indigo — premium dark-luxe.",
    scale: {
      "50": "#e7eaf8",
      "100": "#d7dbf4",
      "200": "#b8bfea",
      "300": "#8c97de",
      "400": "#5d6cd0",
      "500": "#384bc2",
      "600": "#2f3ea2",
      "700": "#263282",
      "800": "#1e2867",
      "900": "#171e4f",
      "950": "#0d112b",
    },
    gradientFrom: "#384bc2",
    gradientTo: "#6138c2",
  },
};

export const BRAND_PALETTE_OPTIONS: { value: BrandPaletteId; label: string }[] = (
  Object.keys(BRAND_PALETTES) as BrandPaletteId[]
).map((id) => ({ value: id, label: BRAND_PALETTES[id].label }));

/** `"#a1b2c3"` -> `"161 178 195"` — the space-separated triplet format Tailwind's
 * `rgb(var(--x) / <alpha-value>)` color functions expect. */
function hexToRgbTriplet(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Writes a palette's colors onto `document.documentElement` as the CSS custom
 * properties `tailwind.config.ts`'s `brand` color scale and gradient utilities read
 * from — this is the one function that makes the whole site's brand color live.
 *
 * `gradientStyle` (default `"gradient"`) controls the two-stop gradient tokens: in
 * `"flat"` mode both `--brand-gradient-from`/`-to` are written with the *same* color
 * (the preset's 600 step, a touch deeper than 500 so flat CTAs keep good contrast),
 * so `bg-brand-gradient`/`bg-brand-gradient-soft` render as a single flat wash instead
 * of a two-tone diagonal — no separate utility classes needed, every existing gradient
 * usage across the site just collapses automatically. */
export function applyBrandPalette(paletteId: BrandPaletteId, gradientStyle: BrandGradientStyle = "gradient") {
  if (typeof document === "undefined") return;
  const palette = BRAND_PALETTES[paletteId] ?? BRAND_PALETTES.violet;
  const root = document.documentElement;
  for (const step of BRAND_COLOR_STEPS) {
    root.style.setProperty(`--brand-${step}`, hexToRgbTriplet(palette.scale[step]));
  }
  const flat = gradientStyle === "flat";
  root.style.setProperty("--brand-gradient-from", hexToRgbTriplet(flat ? palette.scale["600"] : palette.gradientFrom));
  root.style.setProperty("--brand-gradient-to", hexToRgbTriplet(flat ? palette.scale["600"] : palette.gradientTo));
}
