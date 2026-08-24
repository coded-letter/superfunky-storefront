export const CODE_THEME_OPTIONS = [
  { value: "auto", label: "Auto (site theme)" },
  { value: "one-light", label: "One Light" },
  { value: "one-dark", label: "One Dark" },
  { value: "dracula", label: "Dracula" },
  { value: "duotone-light", label: "Duotone Light" },
  { value: "duotone-dark", label: "Duotone Dark" },
  { value: "prism", label: "Prism Default" },
  { value: "coy", label: "Prism Coy" },
  { value: "dark", label: "Prism Dark" },
  { value: "funky", label: "Prism Funky" },
  { value: "okaidia", label: "Prism Okaidia" },
  { value: "solarized-light", label: "Prism Solarized Light" },
  { value: "tomorrow", label: "Prism Tomorrow Night" },
  { value: "twilight", label: "Prism Twilight" },
] as const;

export type CodeThemePreference = (typeof CODE_THEME_OPTIONS)[number]["value"];
export type CodeTheme = Exclude<CodeThemePreference, "auto">;

export function normalizeCodeTheme(value: string | null | undefined): CodeThemePreference {
  const normalized = value?.trim().toLowerCase() || "auto";
  return CODE_THEME_OPTIONS.find((option) => option.value === normalized)?.value ?? "auto";
}

export function resolveAutomaticCodeTheme(): CodeTheme {
  const root = document.documentElement;
  const configured = root.classList.contains("dark")
    ? root.dataset.cmsCodeDarkTheme
    : root.dataset.cmsCodeLightTheme;
  const normalized = normalizeCodeTheme(configured);
  if (normalized !== "auto") return normalized;
  return root.classList.contains("dark") ? "one-dark" : "one-light";
}
