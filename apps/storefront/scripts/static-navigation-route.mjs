export function staticNavHrefMatchesRoute(href, routePath, siteUrl = "") {
  try {
    const resolved = new URL(href, siteUrl || "https://storefront.invalid");
    if (resolved.hash) return false;
    if (siteUrl && resolved.origin !== new URL(siteUrl).origin) return false;
    const normalize = (value) => {
      const path = new URL(value, "https://storefront.invalid").pathname.replace(/\/+$/, "");
      return path || "/";
    };
    return normalize(resolved.href) === normalize(routePath);
  } catch {
    return false;
  }
}
