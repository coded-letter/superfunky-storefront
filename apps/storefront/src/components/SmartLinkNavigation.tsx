import { useEffect } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { normalizeLanguagePath, useLanguage } from "@funky/ui";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { mountSmartLinkNavigation } from "../lib/internalLinks";
import { prefetchStorefrontRoute } from "../lib/routePrefetch";

export function SmartLinkNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
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
    if (navigationType === "POP") return;
    if (!location.hash) {
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

    const rawId = location.hash.slice(1);
    let id = rawId;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      // Browsers leave malformed percent-escapes untouched in fragment identifiers.
    }
    const revealAnchor = () => {
      const target = document.getElementById(id);
      if (!target) return false;
      target.scrollIntoView();
      return true;
    };
    if (revealAnchor()) return;

    const observer = new MutationObserver(() => {
      if (revealAnchor()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 2_000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [location.hash, location.key, navigationType]);

  return null;
}
