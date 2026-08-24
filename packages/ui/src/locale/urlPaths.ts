export function usesLanguagePrefixes(languageCodes: readonly string[]): boolean {
  return new Set(languageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean)).size >= 2;
}

const LANGUAGE_INDEPENDENT_PATHS = new Set(["shortcodes", "layout-studio"]);

function splitPathSuffix(value: string): [string, string] {
  const suffixAt = value.search(/[?#]/);
  return suffixAt < 0 ? [value, ""] : [value.slice(0, suffixAt), value.slice(suffixAt)];
}

export function normalizeLanguagePath(
  value: string,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): string {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const [rawPath, suffix] = splitPathSuffix(value);
  const path = rawPath || "/";
  const codes = [...new Set(configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean))];
  const segments = path.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const hasConfiguredPrefix = Boolean(first && codes.includes(first));
  const routeSegments = hasConfiguredPrefix ? segments.slice(1) : segments;

  if (routeSegments.length === 1 && LANGUAGE_INDEPENDENT_PATHS.has(routeSegments[0].toLowerCase())) {
    const trailing = path.endsWith("/") ? "/" : "";
    return `/${routeSegments[0]}${trailing}${suffix}`;
  }

  if (codes.length < 2) {
    if (!hasConfiguredPrefix) return `${path}${suffix}`;
    const unprefixed = `/${segments.slice(1).join("/")}`;
    const trailing = path.endsWith("/") && unprefixed !== "/" ? "/" : "";
    return `${unprefixed || "/"}${trailing}${suffix}`;
  }

  const selected = codes.includes(languageCode.trim().toLowerCase())
    ? languageCode.trim().toLowerCase()
    : codes[0];
  const rest = routeSegments;
  const trailing = path.endsWith("/") && rest.length ? "/" : "";
  const prefix = selected === codes[0] ? "" : `/${selected}`;
  if (!rest.length) return `${prefix || "/"}${suffix}`;
  return `${prefix}/${rest.join("/")}${trailing}${suffix}`;
}

export function resolveLocalizedPageUri(
  uri: string | null | undefined,
  slug: string | null | undefined,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): string | null {
  if (uri) return normalizeLanguagePath(uri, languageCode, configuredLanguageCodes);
  if (!slug) return null;
  return normalizeLanguagePath(`/${slug}/`, languageCode, configuredLanguageCodes);
}

export function languageHomePath(
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): string {
  if (!usesLanguagePrefixes(configuredLanguageCodes)) return "/";
  const normalizedLanguageCode = languageCode.trim().toLowerCase();
  const defaultLanguageCode = configuredLanguageCodes[0]?.trim().toLowerCase();
  return normalizedLanguageCode === defaultLanguageCode
    ? "/"
    : normalizeLanguagePath("/", normalizedLanguageCode, configuredLanguageCodes);
}

export function resolvePathLanguageCode(
  value: string,
  configuredLanguageCodes: readonly string[],
  defaultLanguageCode: string,
  allowUnconfiguredPrefix = false,
): string {
  const codes = [...new Set(configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean))];
  const [pathname] = splitPathSuffix(value);
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return firstSegment && (
    codes.includes(firstSegment)
    || (allowUnconfiguredPrefix && /^[a-z]{2}(?:-[a-z0-9]+)*$/.test(firstSegment))
  )
    ? firstSegment
    : defaultLanguageCode.trim().toLowerCase();
}

export type CanonicalLanguageRoute<RouteKey extends string = string> = {
  key: RouteKey;
  uri: string;
  languageCode: string;
};

export type CanonicalLanguageRouteResolution<RouteKey extends string = string> = {
  key: RouteKey;
  targetPath: string;
};

function normalizeCanonicalPath(value: string): string {
  const [rawPath] = splitPathSuffix(value);
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURI(rawPath);
  } catch {
    decodedPath = rawPath;
  }
  const path = decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`;
  return path === "/" ? path : `${path.replace(/\/+$/, "")}/`;
}

export function resolveCanonicalLanguagePath<RouteKey extends string>(
  registry: CanonicalLanguageRoute<RouteKey>[],
  key: RouteKey,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
  fallback: string,
): string {
  const entries = registry.filter((entry) => entry.key === key);
  if (!entries.length) {
    return normalizeLanguagePath(fallback, languageCode, configuredLanguageCodes);
  }

  const normalizedLanguageCode = languageCode.trim().toLowerCase();
  const localized = entries.find((entry) => entry.languageCode === normalizedLanguageCode)
    || entries.find((entry) => entry.languageCode === "en")
    || entries[0];
  const languagesAtResolvedUri = new Set(
    entries
      .filter((entry) => entry.uri === localized.uri)
      .map((entry) => entry.languageCode),
  );
  return languagesAtResolvedUri.size > 1
    ? normalizeLanguagePath(localized.uri, languageCode, configuredLanguageCodes)
    : localized.uri;
}

export function resolveCanonicalLanguageRoute<RouteKey extends string>(
  registry: CanonicalLanguageRoute<RouteKey>[],
  pathname: string,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
): CanonicalLanguageRouteResolution<RouteKey> | null {
  const normalizedPathname = normalizeCanonicalPath(pathname);
  const matches = registry.filter((entry) => normalizeCanonicalPath(entry.uri) === normalizedPathname);
  const routeKeys = [...new Set(matches.map(({ key }) => key))];
  if (routeKeys.length !== 1) return null;

  const key = routeKeys[0];
  return {
    key,
    targetPath: resolveCanonicalLanguagePath(
      registry,
      key,
      languageCode,
      configuredLanguageCodes,
      pathname,
    ),
  };
}

export type LanguageUrlAction =
  | { type: "set-language"; languageCode: string }
  | { type: "navigate"; to: string }
  | null;

export function resolveLanguageUrlAction(
  currentUrl: string,
  languageCode: string,
  configuredLanguageCodes: readonly string[],
  languageSelectionChanged: boolean,
): LanguageUrlAction {
  const codes = [...new Set(configuredLanguageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean))];
  const selected = languageCode.trim().toLowerCase();
  const [pathname, suffix] = splitPathSuffix(currentUrl);
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const hasConfiguredPrefix = Boolean(first && codes.includes(first));
  const routeSegments = hasConfiguredPrefix ? segments.slice(1) : segments;
  const isLanguageIndependent = routeSegments.length === 1
    && LANGUAGE_INDEPENDENT_PATHS.has(routeSegments[0].toLowerCase());

  if (!languageSelectionChanged && codes.length >= 2) {
    if (first && codes.includes(first) && first !== selected) {
      return { type: "set-language", languageCode: first };
    }
    if (!hasConfiguredPrefix && selected !== codes[0]) {
      return { type: "set-language", languageCode: codes[0] };
    }
  }

  const target = routeSegments.length === 0
    ? `${languageHomePath(selected, codes)}${suffix}`
    : normalizeLanguagePath(currentUrl, selected, codes);
  const hasDefaultLanguagePrefix = hasConfiguredPrefix && first === codes[0];
  if (
    !languageSelectionChanged
    && pathname !== "/"
    && !isLanguageIndependent
    && !hasDefaultLanguagePrefix
  ) {
    return null;
  }
  return target === currentUrl ? null : { type: "navigate", to: target };
}
