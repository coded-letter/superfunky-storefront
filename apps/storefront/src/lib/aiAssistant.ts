export type AssistantPlacement = "footer" | "header-command-overlay" | "fixed";

export type AssistantIconPreset = "message-circle" | "bot" | "sparkles";

export type AssistantThemeConfig = {
  enabled?: boolean | null;
  nativeProviderActive?: boolean | null;
  placement?: string | null;
  title?: string | null;
  subtitle?: string | null;
  greeting?: string | null;
  composerPlaceholder?: string | null;
  launcherLabel?: string | null;
  iframeUrl?: string | null;
  iframeTitle?: string | null;
  iframeSandbox?: string | null;
  iframeReferrerPolicy?: string | null;
};

export type ResolvedAssistantThemeConfig = {
  enabled: boolean;
  nativeProviderActive: boolean;
  placement: AssistantPlacement;
  title: string;
  subtitle: string;
  greeting: string;
  composerPlaceholder: string;
  launcherLabel: string;
  iframeUrl: string | null;
  iframeTitle: string;
  iframeSandbox: string;
  iframeReferrerPolicy: "no-referrer" | "strict-origin-when-cross-origin";
};

export type AssistantNativeAppearance = {
  launcher_mode?: string | null;
  icon_preset?: string | null;
  custom_icon_url?: string | null;
  texture_url?: string | null;
  environment_url?: string | null;
  launcher_label?: string | null;
};

export type AssistantConfigResponse = {
  has_api_key?: boolean;
  appearance?: AssistantNativeAppearance | null;
};

export type AssistantNativeProvider = {
  close?: () => void | Promise<void>;
  getConfig?: () => AssistantConfigResponse | null | undefined | Promise<AssistantConfigResponse | null | undefined>;
  isAvailable?: () => boolean;
  isConfigured?: () => boolean;
  open?: () => void | Promise<void>;
  toggle?: () => void | Promise<void>;
};

export type NativeProviderDiscovery =
  | {
      status: "ready";
      source: "canonical" | "legacy";
      provider: AssistantNativeProvider;
    }
  | {
      status: "misconfigured";
      source: "canonical" | "legacy";
      reason: string;
    }
  | {
      status: "unavailable";
    };

export type ValidatedAssistantIframe = {
  origin: string;
  src: string;
};

export type ResolvedLauncherAppearance =
  | {
      kind: "custom";
      customIconUrl: string;
      iconPreset: AssistantIconPreset;
      label: string;
    }
  | {
      kind: "3d";
      iconPreset: AssistantIconPreset;
      label: string;
      environmentUrl: string | null;
      textureUrl: string | null;
    }
  | {
      kind: "flat";
      iconPreset: AssistantIconPreset;
      label: string;
    };

export type ResolvedAssistantRuntime =
  | {
      kind: "hidden";
      launcher: ResolvedLauncherAppearance;
      reason: string;
      theme: ResolvedAssistantThemeConfig;
    }
  | {
      kind: "iframe";
      iframe: ValidatedAssistantIframe;
      launcher: ResolvedLauncherAppearance;
      theme: ResolvedAssistantThemeConfig;
    }
  | {
      kind: "native";
      launcher: ResolvedLauncherAppearance;
      provider: AssistantNativeProvider;
      source: "canonical" | "legacy";
      theme: ResolvedAssistantThemeConfig;
    }
  | {
      kind: "rest";
      configured: boolean;
      launcher: ResolvedLauncherAppearance;
      theme: ResolvedAssistantThemeConfig;
    };

const DEFAULT_ASSISTANT_THEME: ResolvedAssistantThemeConfig = {
  enabled: false,
  nativeProviderActive: false,
  placement: "footer",
  title: "AI Assistant",
  subtitle: "Site-wide help",
  greeting: "Ask about products, posts, pages, categories, or tags.",
  composerPlaceholder: "Ask the AI Assistant…",
  launcherLabel: "Open AI Assistant",
  iframeUrl: null,
  iframeTitle: "AI Assistant",
  iframeSandbox: "allow-scripts allow-forms allow-popups",
  iframeReferrerPolicy: "strict-origin-when-cross-origin",
};

const NATIVE_PROVIDER_KEYS = [
  ["canonical", "funkycommerceAiAssistant"],
  ["legacy", "aoAgenticShoppingAssistant"],
] as const;

const VALID_ICON_PRESETS = new Set<AssistantIconPreset>(["message-circle", "bot", "sparkles"]);
const VALID_LAUNCHER_MODES = new Set(["icon", "3d"]);
const VALID_PLACEMENTS = new Set<AssistantPlacement>(["footer", "header-command-overlay", "fixed"]);

export function resolveAssistantThemeConfig(
  config: AssistantThemeConfig | null | undefined,
): ResolvedAssistantThemeConfig {
  const requestedPlacement = config?.placement === "header" ? "header-command-overlay" : config?.placement;
  const placement = VALID_PLACEMENTS.has(requestedPlacement as AssistantPlacement)
    ? requestedPlacement as AssistantPlacement
    : DEFAULT_ASSISTANT_THEME.placement;
  return {
    enabled: config?.enabled ?? DEFAULT_ASSISTANT_THEME.enabled,
    nativeProviderActive: config?.nativeProviderActive ?? DEFAULT_ASSISTANT_THEME.nativeProviderActive,
    placement,
    title: trimOrFallback(config?.title, DEFAULT_ASSISTANT_THEME.title),
    subtitle: trimOrFallback(config?.subtitle, DEFAULT_ASSISTANT_THEME.subtitle),
    greeting: trimOrFallback(config?.greeting, DEFAULT_ASSISTANT_THEME.greeting),
    composerPlaceholder: trimOrFallback(config?.composerPlaceholder, DEFAULT_ASSISTANT_THEME.composerPlaceholder),
    launcherLabel: trimOrFallback(config?.launcherLabel, DEFAULT_ASSISTANT_THEME.launcherLabel),
    iframeUrl: trimOrNull(config?.iframeUrl),
    iframeTitle: trimOrFallback(config?.iframeTitle, DEFAULT_ASSISTANT_THEME.iframeTitle),
    iframeSandbox: config?.iframeSandbox === "allow-scripts allow-forms allow-popups"
      ? config.iframeSandbox
      : DEFAULT_ASSISTANT_THEME.iframeSandbox,
    iframeReferrerPolicy: config?.iframeReferrerPolicy === "no-referrer"
      ? "no-referrer"
      : DEFAULT_ASSISTANT_THEME.iframeReferrerPolicy,
  };
}

export function discoverNativeAssistantProvider(
  globalScope: Record<string, unknown>,
): NativeProviderDiscovery {
  for (const [source, key] of NATIVE_PROVIDER_KEYS) {
    const candidate = globalScope[key];
    if (candidate == null) continue;
    if (typeof candidate !== "object" && typeof candidate !== "function") {
      return { status: "misconfigured", source, reason: `${key} is not an assistant provider object.` };
    }
    const provider = candidate as AssistantNativeProvider;
    if (!provider.open && !provider.toggle) {
      return { status: "misconfigured", source, reason: `${key} does not expose open/toggle controls.` };
    }
    try {
      if (provider.isAvailable?.() === false || provider.isConfigured?.() === false) {
        return { status: "misconfigured", source, reason: `${key} reported itself as unavailable.` };
      }
    } catch (error) {
      return {
        status: "misconfigured",
        source,
        reason: error instanceof Error ? error.message : `${key} availability check threw.`,
      };
    }
    return { status: "ready", source, provider };
  }
  return { status: "unavailable" };
}

export function mergeAssistantConfigResponses(
  primary: AssistantConfigResponse | null | undefined,
  secondary: AssistantConfigResponse | null | undefined,
): AssistantConfigResponse | null {
  if (!primary && !secondary) return null;
  return {
    has_api_key: primary?.has_api_key ?? secondary?.has_api_key,
    appearance: primary?.appearance ?? secondary?.appearance ?? null,
  };
}

export function resolveAssistantRuntime(input: {
  currentOrigin?: string;
  fetchedConfig?: AssistantConfigResponse | null;
  nativeDiscovery: NativeProviderDiscovery;
  themeConfig: AssistantThemeConfig | ResolvedAssistantThemeConfig | null | undefined;
}): ResolvedAssistantRuntime {
  const theme = isResolvedAssistantThemeConfig(input.themeConfig)
    ? input.themeConfig
    : resolveAssistantThemeConfig(input.themeConfig);
  const launcher = resolveLauncherAppearance(theme, input.fetchedConfig, input.currentOrigin);
  if (!theme.enabled) {
    return { kind: "hidden", launcher, reason: "theme-disabled", theme };
  }

  const nativeDiscovery = input.nativeDiscovery;

  if (nativeDiscovery.status === "ready") {
    return {
      kind: "native",
      launcher,
      provider: nativeDiscovery.provider,
      source: nativeDiscovery.source,
      theme,
    };
  }

  if (input.fetchedConfig?.has_api_key === false) {
    return { kind: "rest", configured: false, launcher, theme };
  }

  if (input.fetchedConfig?.has_api_key === true) {
    return { kind: "rest", configured: true, launcher, theme };
  }

  if (nativeDiscovery.status === "unavailable") {
    const iframe = validateAssistantIframeSource(theme.iframeUrl, {
      currentOrigin: input.currentOrigin,
    });
    if (iframe) return { kind: "iframe", iframe, launcher, theme };
  }

  return { kind: "rest", configured: theme.nativeProviderActive, launcher, theme };
}

export function resolveLauncherAppearance(
  theme: AssistantThemeConfig | ResolvedAssistantThemeConfig | null | undefined,
  fetchedConfig?: AssistantConfigResponse | null,
  currentOrigin?: string,
): ResolvedLauncherAppearance {
  const resolvedTheme = isResolvedAssistantThemeConfig(theme) ? theme : resolveAssistantThemeConfig(theme);
  const appearance = fetchedConfig?.appearance ?? null;
  const label = trimOrFallback(appearance?.launcher_label, resolvedTheme.launcherLabel);
  const iconPreset = resolveIconPreset(appearance?.icon_preset);
  const customIconUrl = validateAssistantAssetUrl(appearance?.custom_icon_url, currentOrigin);
  if (customIconUrl) {
    return { kind: "custom", customIconUrl, iconPreset, label };
  }
  if (VALID_LAUNCHER_MODES.has(appearance?.launcher_mode || "") && appearance?.launcher_mode === "3d") {
    return {
      kind: "3d",
      iconPreset,
      label,
      environmentUrl: validateAssistantAssetUrl(appearance?.environment_url, currentOrigin),
      textureUrl: validateAssistantAssetUrl(appearance?.texture_url, currentOrigin),
    };
  }
  return { kind: "flat", iconPreset, label };
}

export function validateAssistantIframeSource(
  rawUrl: string | null | undefined,
  options: { allowedOrigins?: string[]; currentOrigin?: string } = {},
): ValidatedAssistantIframe | null {
  const parsed = parseSafeUrl(rawUrl, options.currentOrigin);
  if (!parsed) return null;
  if (!isSecureAssistantUrl(parsed, options.currentOrigin)) return null;
  if (parsed.username || parsed.password) return null;
  const allowedOrigins = (options.allowedOrigins ?? [])
    .map((origin) => normalizeAllowedOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) return null;
  parsed.hash = "";
  return { origin: parsed.origin, src: parsed.toString() };
}

export function validateAssistantAssetUrl(
  rawUrl: string | null | undefined,
  currentOrigin?: string,
): string | null {
  const parsed = parseSafeUrl(rawUrl, currentOrigin);
  if (!parsed) return null;
  if (!isSecureAssistantUrl(parsed, currentOrigin) || parsed.username || parsed.password) return null;
  parsed.hash = "";
  return parsed.toString();
}

export function parseAssistantConfigPayload(payload: string): AssistantConfigResponse | null {
  const parsed = parseJsonObjectPayload(payload);
  if (!parsed) return null;
  const config = parsed as AssistantConfigResponse;
  return (
    typeof config.has_api_key === "boolean"
    || (config.appearance !== null && typeof config.appearance === "object")
  ) ? config : null;
}

export function parseJsonObjectPayload(payload: string): Record<string, unknown> | null {
  const text = payload.trim();
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    const end = findJsonObjectEnd(text, start);
    if (end < 0) continue;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Diagnostics can contain braces before the REST response; try the next object.
    }
  }
  return null;
}

function findJsonObjectEnd(value: string, start: number): number {
  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function isResolvedAssistantThemeConfig(
  value: AssistantThemeConfig | ResolvedAssistantThemeConfig | null | undefined,
): value is ResolvedAssistantThemeConfig {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as ResolvedAssistantThemeConfig).title === "string"
    && typeof (value as ResolvedAssistantThemeConfig).placement === "string"
    && typeof (value as ResolvedAssistantThemeConfig).iframeSandbox === "string",
  );
}

function resolveIconPreset(value: string | null | undefined): AssistantIconPreset {
  return VALID_ICON_PRESETS.has(value as AssistantIconPreset)
    ? value as AssistantIconPreset
    : "message-circle";
}

function parseSafeUrl(rawUrl: string | null | undefined, currentOrigin?: string): URL | null {
  const clean = trimOrNull(rawUrl);
  if (!clean) return null;
  try {
    return new URL(clean, currentOrigin || "https://example.test");
  } catch {
    return null;
  }
}

function isSecureAssistantUrl(url: URL, currentOrigin?: string): boolean {
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  if (currentOrigin && url.origin === currentOrigin) return true;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function normalizeAllowedOrigin(value: string | null | undefined): string | null {
  const clean = trimOrNull(value);
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    if (!isSecureAssistantUrl(parsed)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function trimOrFallback(value: string | null | undefined, fallback: string): string {
  return trimOrNull(value) || fallback;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
