/**
 * @param {{
 *   uri?: string | null;
 *   slug?: string | null;
 *   languageCode?: string | null;
 *   defaultLanguage?: string | null;
 *   configuredLanguageCodes?: string[];
 * }} options
 */
export function storefrontPostPath({
  uri,
  slug,
  languageCode,
  defaultLanguage,
  configuredLanguageCodes = [],
}) {
  const sourcePath = normalizePath(uri);
  const postSlug = normalizeSegment(slug) || sourcePath.split("/").filter(Boolean).at(-1) || "";
  if (!postSlug) return sourcePath || "/";

  const language = languageCode?.trim().toLowerCase() || languageFromPath(sourcePath, configuredLanguageCodes);
  const defaultCode = defaultLanguage?.trim().toLowerCase() || configuredLanguageCodes[0]?.toLowerCase() || "";
  const sourceLanguage = sourcePath.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  const usesLanguagePrefix = configuredLanguageCodes.length
    ? configuredLanguageCodes.length > 1 && language && language !== defaultCode
    : Boolean(language && sourceLanguage === language);

  return `${usesLanguagePrefix ? `/${language}` : ""}/blog/${postSlug}`;
}

/** @param {string} pathname */
export function backendPostUriFromStorefrontPath(pathname) {
  const segments = normalizePath(pathname).split("/").filter(Boolean);
  if (segments.length === 2 && segments[0].toLowerCase() === "blog") {
    return `/${segments[1]}/`;
  }
  if (segments.length === 3 && segments[1].toLowerCase() === "blog") {
    return `/${segments[0]}/${segments[2]}/`;
  }

  const normalized = normalizePath(pathname);
  return normalized === "/" ? normalized : `${normalized}/`;
}

/** @param {string | null | undefined} value */
function normalizePath(value) {
  if (!value) return "";
  try {
    const path = new URL(value, "https://storefront.invalid").pathname;
    return path === "/" ? path : path.replace(/\/+$/, "");
  } catch {
    const path = value.startsWith("/") ? value : `/${value}`;
    return path === "/" ? path : path.replace(/\/+$/, "");
  }
}

/** @param {string | null | undefined} value */
function normalizeSegment(value) {
  if (!value) return "";
  try {
    return encodeURIComponent(decodeURIComponent(value).trim());
  } catch {
    return "";
  }
}

/**
 * @param {string} path
 * @param {string[]} configuredLanguageCodes
 */
function languageFromPath(path, configuredLanguageCodes) {
  const firstSegment = path.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  return configuredLanguageCodes.some((code) => code.toLowerCase() === firstSegment) ? firstSegment : "";
}
