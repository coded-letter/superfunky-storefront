export function sitemapUrl(origin, routePath) {
  const site = new URL(origin);
  const url = new URL(routePath, site);
  if (!/^https?:$/.test(site.protocol) || url.origin !== site.origin) {
    throw new Error("Sitemap routes must resolve to the configured storefront origin.");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname ? `${pathname}/` : "/";
  url.hash = "";
  return url.href;
}
