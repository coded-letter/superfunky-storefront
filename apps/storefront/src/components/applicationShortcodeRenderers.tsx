import { lazy, Suspense, type ReactNode } from "react";
import type { AuthShortcodeMode } from "../pages/AuthMockupPage";
import { ApplicationShortcodeOverrideProvider } from "./applicationShortcodes";
import {
  WORDPRESS_SHORTCODE_RENDERERS,
  type WordPressShortcodeAttributes,
  type WordPressShortcodeRenderer,
} from "./wordpressShortcodes";
import { APPLICATION_SHORTCODE_NAMES, SHORTCODE_ALIASES } from "../lib/shortcodeRegistry.mjs";

const AccountMockupPage = lazy(() => import("../pages/AccountMockupPage").then((module) => ({ default: module.AccountMockupPage })));
const AuthMockupPage = lazy(() => import("../pages/AuthMockupPage").then((module) => ({ default: module.AuthMockupPage })));
const CartMockupPage = lazy(() => import("../pages/CartMockupPage").then((module) => ({ default: module.CartMockupPage })));
const CheckoutMockupPage = lazy(() => import("../pages/CheckoutMockupPage").then((module) => ({ default: module.CheckoutMockupPage })));
const ReadingListMockupPage = lazy(() => import("../pages/ReadingListMockupPage").then((module) => ({ default: module.ReadingListMockupPage })));
const WishlistMockupPage = lazy(() => import("../pages/WishlistMockupPage").then((module) => ({ default: module.WishlistMockupPage })));

function applicationBlock(
  names: string[],
  attributes: WordPressShortcodeAttributes,
  children: ReactNode,
) {
  return (
    <ApplicationShortcodeOverrideProvider names={names} attributes={attributes}>
      <div
        data-funkycommerce-component={names[0]}
        className="my-6 min-h-64 rounded-3xl border border-zinc-200/70 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 sm:p-6"
      >
        <Suspense fallback={<div role="status" aria-busy="true" className="min-h-56" />}>
          {children}
        </Suspense>
      </div>
    </ApplicationShortcodeOverrideProvider>
  );
}

export const APPLICATION_SHORTCODE_RENDERERS: Record<string, WordPressShortcodeRenderer> = {
  product_archive: (attributes) => applicationBlock(
    ["funkycommerce_shop"],
    attributes,
    WORDPRESS_SHORTCODE_RENDERERS.grid({ ...attributes, type: "product" }),
  ),
  post_archive: (attributes) => applicationBlock(
    ["funkycommerce_blog"],
    attributes,
    WORDPRESS_SHORTCODE_RENDERERS.grid({ ...attributes, type: "post" }),
  ),
  cart: (attributes) => applicationBlock(["funkycommerce_cart", "woocommerce_cart"], attributes, <CartMockupPage />),
  checkout: (attributes) => applicationBlock(["funkycommerce_checkout", "woocommerce_checkout"], attributes, <CheckoutMockupPage />),
  wishlist: (attributes) => applicationBlock(["funkycommerce_wishlist"], attributes, <WishlistMockupPage />),
  reading_list: (attributes) => applicationBlock(["funkycommerce_reading_list"], attributes, <ReadingListMockupPage />),
  account: (attributes) => applicationBlock(["funkycommerce_account", "woocommerce_my_account"], attributes, <AccountMockupPage />),
  auth: (attributes) => {
    const mode = ["login", "register", "forgot-password", "combined"].includes(attributes.mode)
      ? attributes.mode as AuthShortcodeMode
      : "login";
    return applicationBlock(["funkycommerce_auth"], attributes, <AuthMockupPage mode={mode} />);
  },
};

APPLICATION_SHORTCODE_RENDERERS.funkycommerce_cart = APPLICATION_SHORTCODE_RENDERERS.cart;
APPLICATION_SHORTCODE_RENDERERS.woocommerce_cart = APPLICATION_SHORTCODE_RENDERERS.cart;
APPLICATION_SHORTCODE_RENDERERS.funkycommerce_checkout = APPLICATION_SHORTCODE_RENDERERS.checkout;
APPLICATION_SHORTCODE_RENDERERS.woocommerce_checkout = APPLICATION_SHORTCODE_RENDERERS.checkout;
APPLICATION_SHORTCODE_RENDERERS.funkycommerce_account = APPLICATION_SHORTCODE_RENDERERS.account;
APPLICATION_SHORTCODE_RENDERERS.woocommerce_my_account = APPLICATION_SHORTCODE_RENDERERS.account;

for (const [alias, canonical] of Object.entries(SHORTCODE_ALIASES)) {
  APPLICATION_SHORTCODE_RENDERERS[alias] = APPLICATION_SHORTCODE_RENDERERS[canonical];
}

for (const name of APPLICATION_SHORTCODE_NAMES) {
  if (!APPLICATION_SHORTCODE_RENDERERS[name]) {
    throw new Error(`Missing application shortcode renderer: ${name}`);
  }
}
