import type { StorefrontBackendProfile } from "@funky/sdk";

export type BackendDataRequirements = {
  commerce: boolean;
  blog: boolean;
  stickyPosts: boolean;
  community: boolean;
};

const stripLanguagePrefix = (pathname: string): string =>
  pathname.replace(/^\/[a-z]{2}(?=\/|$)/i, "") || "/";

type ShortcodeMarker = {
  name: string;
  type: string;
};

const readAttribute = (tag: string, name: string): string =>
  tag.match(new RegExp(`\\bdata-${name}=["']([^"']*)["']`, "i"))?.[1]?.toLowerCase() || "";

function readShortcodeMarkers(markup: string): ShortcodeMarker[] {
  const normalizedMarkup = markup.replaceAll('\\"', '"').replaceAll("\\'", "'");
  return [...normalizedMarkup.matchAll(/<[^>]*\bdata-funkycommerce-(?:shortcode|component)=["'][^"']+["'][^>]*>/gi)]
    .map(([tag]) => ({
      name: tag.match(/\bdata-funkycommerce-(?:shortcode|component)=["']([^"']+)["']/i)?.[1]?.toLowerCase() || "",
      type: readAttribute(tag, "type"),
    }))
    .filter(({ name }) => Boolean(name));
}

export function resolveBackendDataRequirements(
  profile: StorefrontBackendProfile,
  pathname: string,
  renderedMarkup: string,
): BackendDataRequirements {
  const route = stripLanguagePrefix(pathname).toLowerCase();
  const markup = renderedMarkup.toLowerCase();
  const markers = readShortcodeMarkers(markup);
  const isHome = route === "/";
  const isShortcodeLibrary = route === "/shortcodes";
  const hasRelatedSections = markup.includes("related-sections");
  const hasStickyPosts = markers.some(({ name }) => name === "sticky-posts" || name === "sticky_posts");
  const hasPostCollection = markers.some(({ name, type }) =>
    type === "post"
    || ["authors", "comments", "tags", "post_archive", "funkycommerce_blog", "reading_list", "funkycommerce_reading_list"].includes(name)
    || name === "sticky-posts"
    || name === "sticky_posts",
  );
  const hasProductCollection = markers.some(({ name, type }) => {
    if (type === "product" || type === "brand") return true;
    if (["reviews", "testimonials", "product_archive", "funkycommerce_shop"].includes(name)) return true;
    if (["categories", "slider", "carousel", "grid"].includes(name)) {
      return !["campaign", "cinematic", "post", "community-article"].includes(type);
    }
    return false;
  });
  const hasCommunityCollection = markers.some(({ name, type }) =>
    name.startsWith("community-") || type === "community-article",
  );
  const isBlogRoute = /^\/(?:blog|author|reading-list)(?:\/|$)/.test(route);
  const isCommerceRoute = /^\/(?:shop|product|product-category|product-tag|brand|cart|checkout|wishlist|order)(?:\/|$)/.test(route);
  const isCommunityRoute = /^\/(?:community|community-author|community-tag|account|layout-studio)(?:\/|$)/.test(route);

  return {
    commerce: profile !== "blog"
      && profile !== "shell"
      && (isHome || isCommerceRoute || isShortcodeLibrary || hasProductCollection || hasRelatedSections),
    blog: isBlogRoute
      || isShortcodeLibrary
      || hasPostCollection
      || hasRelatedSections
      || (isHome && (profile === "blog" || profile === "full")),
    stickyPosts: hasStickyPosts,
    community: profile === "full"
      && (isCommunityRoute || isShortcodeLibrary || hasCommunityCollection),
  };
}
