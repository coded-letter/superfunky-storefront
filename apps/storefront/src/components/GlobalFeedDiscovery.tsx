import { Helmet } from "react-helmet-async";

export function GlobalFeedDiscovery() {
  return (
    <Helmet>
      <link rel="alternate" type="application/rss+xml" title="Store updates (RSS)" href="/feed.xml" />
      <link rel="alternate" type="application/atom+xml" title="Store updates (Atom)" href="/atom.xml" />
      <link rel="alternate" type="application/rss+xml" title="Product feed" href="/product.feed.xml" />
      <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
    </Helmet>
  );
}
