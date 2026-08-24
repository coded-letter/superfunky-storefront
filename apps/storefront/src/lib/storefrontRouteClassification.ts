import { canonicalShortcodeName } from "./shortcodeRegistry.mjs";

export type StorefrontRouteKey =
  | "home"
  | "shop"
  | "blog"
  | "cart"
  | "checkout"
  | "account"
  | "wishlist"
  | "reading-list"
  | "community"
  | "auth-login"
  | "auth-register"
  | "auth-forgot-password"
  | "order-success"
  | "order-success-digital"
  | "unsubscribe";

export type RoutePageNode = {
  uri: string | null;
  slug: string | null;
  language: { code: string | null } | null;
  isFrontPage?: boolean | null;
  headlessShortcodes?: (string | null)[] | null;
};

export function resolveRoutePageUri(page: RoutePageNode): string | null {
  if (page.uri) return page.uri;
  return page.slug ? `/${page.slug}/` : null;
}

export const ROUTE_PAGE_RECIPES: Record<StorefrontRouteKey, readonly string[]> = {
  home: [],
  shop: ["product_archive"],
  blog: ["post_archive"],
  cart: ["cart"],
  checkout: ["checkout"],
  account: ["account"],
  wishlist: ["wishlist"],
  "reading-list": ["reading_list"],
  community: ["community-feed", "community-hero"],
  "auth-login": ["auth"],
  "auth-register": ["auth"],
  "auth-forgot-password": ["auth"],
  "order-success": ["order-success"],
  "order-success-digital": ["order-success"],
  unsubscribe: ["unsubscribe-form"],
};

const SHORTCODE_ROUTE_KEYS: Record<string, StorefrontRouteKey> = {
  product_archive: "shop",
  post_archive: "blog",
  cart: "cart",
  checkout: "checkout",
  account: "account",
  wishlist: "wishlist",
  reading_list: "reading-list",
  "community-feed": "community",
  "community-hero": "community",
  "unsubscribe-form": "unsubscribe",
};

function parseShortcodeAttributes(shortcode: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of shortcode.matchAll(/([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g)) {
    attributes[match[1].replaceAll("_", "-")] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

export function classifyPageRouteKeys(page: RoutePageNode): StorefrontRouteKey[] {
  if (page.isFrontPage) return ["home"];

  const keys = new Set<StorefrontRouteKey>();
  const shortcodes = page.headlessShortcodes?.filter((shortcode): shortcode is string => Boolean(shortcode)) || [];

  for (const shortcode of shortcodes) {
    const rawName = shortcode.match(/^\[([^\s\]]+)/)?.[1];
    if (!rawName) continue;
    const name = canonicalShortcodeName(rawName);
    const routeKey = SHORTCODE_ROUTE_KEYS[name];
    if (routeKey) {
      keys.add(routeKey);
      continue;
    }
    if (name === "grid") {
      const attributes = parseShortcodeAttributes(shortcode);
      const isPaginated = ["1", "true", "yes", "on"].includes(
        (attributes.paginated || "").toLowerCase(),
      );
      if (attributes.type === "post" && isPaginated) {
        keys.add("blog");
      }
      continue;
    }
    if (name === "order-success") {
      const attributes = parseShortcodeAttributes(shortcode);
      keys.add(attributes.mode === "digital" ? "order-success-digital" : "order-success");
      continue;
    }
    if (name === "auth") {
      const attributes = parseShortcodeAttributes(shortcode);
      if (attributes.mode === "register") {
        keys.add("auth-register");
      } else if (attributes.mode === "forgot-password") {
        keys.add("auth-forgot-password");
      } else {
        keys.add("auth-login");
      }
    }
  }

  return keys.size === 1 ? [...keys] : [];
}
