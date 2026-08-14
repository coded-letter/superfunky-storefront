import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@funky/ui";

type ContentTranslation = {
  languageCode: string;
  uri: string;
};

export function useCanonicalContentLanguage(
  sourceLanguageCode: string | null | undefined,
  translations: ContentTranslation[],
  pathname: string,
  isTranslationDataResolved = true,
  isEnabled = true,
): void {
  const navigate = useNavigate();
  const {
    hasLanguagePreference,
    languageCode,
    languageSelectionRevision,
    setLanguageCodeFromRoute,
  } = useLanguage();
  const handledSelectionRevision = useRef(0);
  const pendingTranslation = useRef<{ path: string; languageCode: string } | null>(null);
  const knownRoutes = useRef<ContentTranslation[]>([]);
  const resolvedRoutePath = useRef<string | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      handledSelectionRevision.current = languageSelectionRevision;
      pendingTranslation.current = null;
      knownRoutes.current = [];
      resolvedRoutePath.current = null;
      return;
    }

    const normalizedLanguage = languageCode.toLowerCase();
    const languageSelectionChanged = handledSelectionRevision.current !== languageSelectionRevision;

    if (pendingTranslation.current) {
      if (samePath(pendingTranslation.current.path, pathname)) {
        if (pendingTranslation.current.languageCode !== normalizedLanguage) {
          setLanguageCodeFromRoute(pendingTranslation.current.languageCode);
        }
        pendingTranslation.current = null;
      }
      handledSelectionRevision.current = languageSelectionRevision;
      return;
    }

    if (sourceLanguageCode) {
      knownRoutes.current = mergeKnownRoutes(
        sourceLanguageCode,
        pathname,
        translations,
        knownRoutes.current,
      );
    }

    const currentRoute = knownRoutes.current.find(
      (route) => samePath(toInternalPath(route.uri), pathname),
    );
    if (!currentRoute) return;
    const routeLanguage = currentRoute.languageCode.toLowerCase();
    const routeChanged = !resolvedRoutePath.current || !samePath(resolvedRoutePath.current, pathname);
    const shouldHonorSelectedLanguage = languageSelectionChanged
      || (routeChanged && hasLanguagePreference && routeLanguage !== normalizedLanguage);

    if (shouldHonorSelectedLanguage) {
      const selectedRoute = knownRoutes.current.find(
        (route) => route.languageCode.toLowerCase() === normalizedLanguage,
      );
      if (!selectedRoute) {
        if (!isTranslationDataResolved) return;
        handledSelectionRevision.current = languageSelectionRevision;
        resolvedRoutePath.current = pathname;
        return;
      }

      handledSelectionRevision.current = languageSelectionRevision;
      resolvedRoutePath.current = pathname;
      const selectedPath = toInternalPath(selectedRoute.uri);
      if (!samePath(selectedPath, pathname)) {
        pendingTranslation.current = {
          path: selectedPath,
          languageCode: normalizedLanguage,
        };
        navigate(selectedPath, { replace: true });
      }
      return;
    }

    handledSelectionRevision.current = languageSelectionRevision;
    resolvedRoutePath.current = pathname;
    if (routeLanguage !== normalizedLanguage) {
      setLanguageCodeFromRoute(routeLanguage);
    }
  }, [
    languageCode,
    languageSelectionRevision,
    hasLanguagePreference,
    isEnabled,
    isTranslationDataResolved,
    navigate,
    pathname,
    setLanguageCodeFromRoute,
    sourceLanguageCode,
    translations,
  ]);
}

function mergeKnownRoutes(
  sourceLanguageCode: string,
  pathname: string,
  translations: ContentTranslation[],
  existingRoutes: ContentTranslation[],
): ContentTranslation[] {
  const routes = new Map<string, ContentTranslation>();
  if (existingRoutes.some((route) => samePath(toInternalPath(route.uri), pathname))) {
    for (const route of existingRoutes) {
      routes.set(route.languageCode.toLowerCase(), route);
    }
  }
  routes.set(sourceLanguageCode.toLowerCase(), {
    languageCode: sourceLanguageCode,
    uri: pathname,
  });
  for (const translation of translations) {
    routes.set(translation.languageCode.toLowerCase(), translation);
  }
  return [...routes.values()];
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => value === "/" ? value : value.replace(/\/+$/, "");
  return normalize(left) === normalize(right);
}

function toInternalPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
