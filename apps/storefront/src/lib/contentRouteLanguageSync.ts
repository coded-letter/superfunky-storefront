type RouteLanguageSyncDecision = {
  pendingSelectionPath: string | null;
  shouldSynchronizeRouteLanguage: boolean;
};

export function resolveRouteLanguageSync(
  pendingSelectionPath: string | null,
  pathname: string,
  languageSelectionChanged: boolean,
): RouteLanguageSyncDecision {
  if (languageSelectionChanged) {
    return {
      pendingSelectionPath: pathname,
      shouldSynchronizeRouteLanguage: false,
    };
  }
  if (pendingSelectionPath === pathname) {
    return {
      pendingSelectionPath,
      shouldSynchronizeRouteLanguage: false,
    };
  }
  return {
    pendingSelectionPath: null,
    shouldSynchronizeRouteLanguage: true,
  };
}
