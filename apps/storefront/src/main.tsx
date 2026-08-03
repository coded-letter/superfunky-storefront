import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./lib/push";
import { preloadIncrementalData } from "./lib/incrementalData";
import { getNavigationData } from "./lib/navigation";
import { getWordPressThemeStyles } from "./lib/themeStyles";
import "./styles.css";

// Kick off the two most critical fetches immediately at module evaluation time —
// before React mounts, before any provider tree renders. This means:
//   1. On a cold load (no cache): the network request starts ~50ms earlier,
//      so by the time NavigationDataProvider/WordPressThemeStylesProvider mount
//      they share the same in-flight promise — no duplicate requests, no gap.
//   2. On a warm cache (localStorage hit): preloadIncrementalData fills the
//      in-memory cache synchronously, so every provider reads data = truthy
//      on its very first useState initialisation — isLoading is false from
//      the start and no loading indicator ever mounts.
// Language key: read from localStorage the same way LanguageContext does so
// the nav cache key matches what the provider will request.
const storedLang = (() => {
  try { return window.localStorage.getItem("funkycommerce-language")?.toLowerCase() || "en"; } catch { return "en"; }
})();
const navigationPreload = preloadIncrementalData(
  `navigation-data:v7:${storedLang}`,
  () => getNavigationData(storedLang),
);
void preloadIncrementalData("wordpress-theme-styles:v3", getWordPressThemeStyles);

// Resolve the backend language record before preloading language-filtered content.
const pathToPageKey: Record<string, string> = {
  "/": "home",
  "/sklep": "shop", "/shop": "shop",
  "/koszyk": "cart", "/cart": "cart",
  "/zamowienie": "checkout", "/checkout": "checkout",
  "/moje-konto": "account", "/account": "account",
};
const currentPageKey = pathToPageKey[window.location.pathname.replace(/\/$/, "") || "/"];
void navigationPreload.then((navigation) => {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  const routeLanguage = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const language = navigation.languages.find(({ code }) => code === routeLanguage)
    ?? navigation.languages.find(({ code }) => code === storedLang)
    ?? navigation.languages[0];
  if (!language) return;
  const pageKey = currentPageKey || (pathname === `/${language.code}` ? "home" : null);
  if (!pageKey) return;
  void preloadIncrementalData(
    `special-page:v5:${pageKey}:${language.code}:${language.backendCode}`,
    () => import("./lib/pages").then(({ getSpecialPage }) =>
      getSpecialPage(pageKey as never, language.code, language.backendCode)),
  );
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// No-ops outside production builds (see `registerServiceWorker`'s guard) so the Vite
// dev server's own module reloading is never fought by a stale cached worker.
void registerServiceWorker();
