import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeLanguagePath, useLanguage } from "@funky/ui";
import { mergeKnownRoutes, samePath, toInternalPath } from "./canonicalContentRoutes";

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
  sourceUri?: string | null,
): void {
  const navigate = useNavigate();
  const {
    hasLanguagePreference,
    languageCode,
    languageSelectionRevision,
    configuredLanguageCodes,
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
        sourceUri,
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
      const selectedPath = normalizeLanguagePath(
        toInternalPath(selectedRoute.uri),
        normalizedLanguage,
        configuredLanguageCodes,
      );
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
    configuredLanguageCodes,
    hasLanguagePreference,
    isEnabled,
    isTranslationDataResolved,
    navigate,
    pathname,
    setLanguageCodeFromRoute,
    sourceLanguageCode,
    sourceUri,
    translations,
  ]);
}
