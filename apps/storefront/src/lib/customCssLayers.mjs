const DEFERRED_MARKER = /^\s*\/\* storefront:deferred \*\/\s*$/m;

export function splitCustomCss(css = "") {
  const marker = DEFERRED_MARKER.exec(css);
  if (!marker) return { critical: css, deferred: "" };
  return { critical: css.slice(0, marker.index), deferred: css.slice(marker.index + marker[0].length) };
}

export function activateDeferredThemeStyles(document) {
  const links = document.querySelectorAll("link[data-wordpress-deferred-style]");
  const activate = () => links.forEach((link) => { link.media = "all"; });
  const timer = setTimeout(activate, 2_000);
  const onLoad = () => {
    clearTimeout(timer);
    activate();
  };
  if (document.readyState === "complete") onLoad();
  else document.defaultView?.addEventListener("load", onLoad, { once: true });
}
