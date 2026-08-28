import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { normalizeLanguagePath, useLanguage } from "@funky/ui";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { mountHashAnchorScroll, mountSmartLinkNavigation } from "../lib/internalLinks";
import { prefetchStorefrontRoute } from "../lib/routePrefetch";

export function SmartLinkNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const initialLocation = useRef(true);
  const { languageCode, languageBackendCode, configuredLanguageCodes } = useLanguage();

  useEffect(() => mountSmartLinkNavigation({
    document,
    window,
    backendOrigin: BACKEND_ORIGIN,
    normalizeTo: (to) => normalizeLanguagePath(to, languageCode, configuredLanguageCodes),
    navigate,
    prefetch: (to) => prefetchStorefrontRoute(
      to,
      languageCode,
      languageBackendCode,
      configuredLanguageCodes,
    ),
  }), [configuredLanguageCodes, languageBackendCode, languageCode, navigate]);

  useEffect(() => {
    const isInitialLocation = initialLocation.current;
    initialLocation.current = false;
    if (!location.hash) {
      if (navigationType === "POP") return;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      const main = document.querySelector<HTMLElement>("main");
      if (main) {
        const hadTabIndex = main.hasAttribute("tabindex");
        if (!hadTabIndex) main.tabIndex = -1;
        main.focus({ preventScroll: true });
        if (!hadTabIndex) main.removeAttribute("tabindex");
      }
      return;
    }
    if (navigationType === "POP" && !isInitialLocation) return;
    return mountHashAnchorScroll({
      document,
      window,
      hash: location.hash,
    });
  }, [location.hash, location.key, navigationType]);

  return null;
}
