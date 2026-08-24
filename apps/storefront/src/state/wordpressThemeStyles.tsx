import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIncrementalData } from "@funky/sdk/react";
import {
  afterMountedPageStylesSettle,
  applyThemePresetVariables,
  createWordPressElementTypographyCss,
  mountPageStyles,
} from "../lib/pageStyles";
import { getWordPressThemeStyles } from "../lib/themeStyles";
import type { CmsThemeStyles } from "../lib/pages";
import { BACKEND_ORIGIN } from "@funky/sdk";

type WordPressThemeStylesContextValue = {
  data: CmsThemeStyles | null;
  ready: boolean;
};

const WordPressThemeStylesContext = createContext<WordPressThemeStylesContextValue>({
  data: null,
  ready: true,
});

export function WordPressThemeStylesProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { data, isLoading, isRevalidating, error } = useIncrementalData(
    "wordpress-theme-styles:v5",
    getWordPressThemeStyles,
    enabled,
  );
  const [appliedData, setAppliedData] = useState<CmsThemeStyles | null>(null);
  const [hasLoadedStaticStyleSeed] = useState(() => Boolean(
    document.head.querySelector<HTMLLinkElement | HTMLStyleElement>('[data-wordpress-static-style-source]')?.sheet
    && document.head.querySelector('style[data-storefront-static-theme]'),
  ));

  useLayoutEffect(() => {
    if (!data) {
      setAppliedData(null);
      return undefined;
    }
    const unmountStyles = mountPageStyles(data, BACKEND_ORIGIN);
    const restoreVariables = applyThemePresetVariables(data);
    const unmountThemePalette = mountWordPressThemePalette(data.colors);
    const unmountElementTypography = mountWordPressElementTypography(data.globalStyles);
    const stopWaitingForStylesheets = afterMountedPageStylesSettle(() => setAppliedData(data));
    return () => {
      stopWaitingForStylesheets();
      unmountElementTypography();
      unmountThemePalette();
      restoreVariables();
      unmountStyles();
    };
  }, [data]);

  const ready = !enabled
    || hasLoadedStaticStyleSeed
    || (!isLoading && !isRevalidating && (Boolean(error) || (Boolean(data) && appliedData === data)));
  const value = useMemo(() => ({ data, ready }), [data, ready]);

  return <WordPressThemeStylesContext.Provider value={value}>{children}</WordPressThemeStylesContext.Provider>;
}

export function useWordPressThemeStyles(): CmsThemeStyles | null {
  return useContext(WordPressThemeStylesContext).data;
}

export function useWordPressThemeStylesReady(): boolean {
  return useContext(WordPressThemeStylesContext).ready;
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
  const css = createWordPressElementTypographyCss(globalStyles);
  if (!css) return () => undefined;

  const style = document.createElement("style");
  style.dataset.funkyWordPressElementTypography = "true";
  style.textContent = css;
  document.head.appendChild(style);
  return () => style.remove();
}
