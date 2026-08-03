import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useIncrementalData } from "../lib/incrementalData";
import { applyThemePresetVariables, mountPageStyles } from "../lib/pageStyles";
import { getWordPressThemeStyles } from "../lib/themeStyles";
import type { CmsThemeStyles } from "../lib/pages";

const WordPressThemeStylesContext = createContext<CmsThemeStyles | null>(null);

export function WordPressThemeStylesProvider({ children }: { children: ReactNode }) {
  const { data } = useIncrementalData("wordpress-theme-styles:v3", getWordPressThemeStyles);

  useEffect(() => {
    if (!data) return undefined;
    const unmountStyles = mountPageStyles(data);
    const restoreVariables = applyThemePresetVariables(data);
    const unmountThemePalette = mountWordPressThemePalette(data.colors);
    const unmountElementTypography = mountWordPressElementTypography(data.globalStyles);
    return () => {
      unmountElementTypography();
      unmountThemePalette();
      restoreVariables();
      unmountStyles();
    };
  }, [data]);

  return <WordPressThemeStylesContext.Provider value={data}>{children}</WordPressThemeStylesContext.Provider>;
}

export function useWordPressThemeStyles(): CmsThemeStyles | null {
  return useContext(WordPressThemeStylesContext);
}

function mountWordPressThemePalette(colors: CmsThemeStyles["colors"]): () => void {
  const primary = colors.find(({ slug }) => slug === "brand")
    || colors.find(({ slug }) => slug === "primary")
    || colors.find(({ slug }) => slug === "accent")
    || colors[2];
  const background = colors.find(({ slug }) => slug === "background");
  const foreground = colors.find(({ slug }) => slug === "foreground");
  const primaryRgb = primary ? parseCssColor(primary.color) : null;
  const backgroundRgb = background ? parseCssColor(background.color) : null;
  const foregroundRgb = foreground ? parseCssColor(foreground.color) : null;
  if (!primaryRgb && !backgroundRgb && !foregroundRgb) return () => undefined;

  const steps: Record<string, [number, number, number]> | null = primaryRgb
    ? {
        "50": mixColor(primaryRgb, [255, 255, 255], 0.95),
        "100": mixColor(primaryRgb, [255, 255, 255], 0.9),
        "200": mixColor(primaryRgb, [255, 255, 255], 0.75),
        "300": mixColor(primaryRgb, [255, 255, 255], 0.55),
        "400": mixColor(primaryRgb, [255, 255, 255], 0.3),
        "500": primaryRgb,
        "600": mixColor(primaryRgb, [0, 0, 0], 0.12),
        "700": mixColor(primaryRgb, [0, 0, 0], 0.25),
        "800": mixColor(primaryRgb, [0, 0, 0], 0.4),
        "900": mixColor(primaryRgb, [0, 0, 0], 0.55),
        "950": mixColor(primaryRgb, [0, 0, 0], 0.7),
      }
    : null;
  const declarations = [
    ...(steps
      ? [
          ...Object.entries(steps).map(([step, value]) => `--brand-${step}:${value.join(" ")};`),
          `--brand-gradient-from:${steps["500"].join(" ")};`,
          `--brand-gradient-to:${steps["600"].join(" ")};`,
        ]
      : []),
    ...(backgroundRgb ? [`--theme-background:${backgroundRgb.join(" ")};`] : []),
    ...(foregroundRgb ? [`--theme-foreground:${foregroundRgb.join(" ")};`] : []),
  ];
  const style = document.createElement("style");
  style.dataset.funkyWordPressPalette = "true";
  style.textContent = `:root{${declarations.join("")}}`;
  document.head.appendChild(style);
  return () => style.remove();
}

function parseCssColor(color: string): [number, number, number] | null {
  const probe = document.createElement("span");
  probe.style.color = color;
  if (!probe.style.color) return null;
  probe.hidden = true;
  document.body.appendChild(probe);
  const match = getComputedStyle(probe).color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  probe.remove();
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function mixColor(
  source: [number, number, number],
  target: [number, number, number],
  ratio: number,
): [number, number, number] {
  return source.map((channel, index) => Math.round(channel + (target[index] - channel) * ratio)) as [number, number, number];
}

function mountWordPressElementTypography(globalStyles: string): () => void {
  const textFont = findFontFamily(globalStyles, (selector) => selector.split(",").some((part) => part.trim() === "body"));
  const linkFont = findFontFamily(globalStyles, (selector) => selector.includes("a:where")) || textFont;
  const headingFont = findFontFamily(globalStyles, (selector) => /(^|,)\s*h[1-6](\s|,|$)/.test(selector)) || textFont;
  const captionFont = findFontFamily(globalStyles, (selector) => selector.includes("caption")) || textFont;
  const buttonFont = findFontFamily(globalStyles, (selector) => selector.includes("wp-element-button")) || textFont;
  if (!textFont && !linkFont && !headingFont && !captionFont && !buttonFont) return () => undefined;

  const style = document.createElement("style");
  style.dataset.funkyWordPressElementTypography = "true";
  style.textContent = [
    textFont ? `body{font-family:${textFont}!important}` : "",
    linkFont ? `body :where(a:not(.wp-element-button):not(.wp-block-button__link)){font-family:${linkFont}!important}` : "",
    headingFont ? `body :where(h1,h2,h3,h4,h5,h6,.wp-block-heading,.funky-brand-heading){font-family:${headingFont}!important}` : "",
    captionFont ? `body :where(figcaption,.wp-element-caption,caption){font-family:${captionFont}!important}` : "",
    buttonFont && buttonFont !== "inherit"
      ? `body :where(.wp-element-button,.wp-block-button__link,button,input[type="button"],input[type="submit"],input[type="reset"]){font-family:${buttonFont}!important}`
      : "",
  ].join("");
  document.head.appendChild(style);
  return () => style.remove();
}

function findFontFamily(css: string, matchesSelector: (selector: string) => boolean): string | null {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (!matchesSelector(match[1])) continue;
    const declaration = match[2].match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i);
    if (declaration) return declaration[1].trim();
  }
  return null;
}
