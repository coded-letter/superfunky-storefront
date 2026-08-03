import type { ReactNode } from "react";
import { AccountMockupPage } from "../pages/AccountMockupPage";
import { AuthMockupPage, type AuthMode } from "../pages/AuthMockupPage";
import { CartMockupPage } from "../pages/CartMockupPage";
import { CheckoutMockupPage } from "../pages/CheckoutMockupPage";
import { ReadingListMockupPage } from "../pages/ReadingListMockupPage";
import { WishlistMockupPage } from "../pages/WishlistMockupPage";
import { ApplicationShortcodeOverrideProvider } from "./applicationShortcodes";
import type { WordPressShortcodeAttributes, WordPressShortcodeRenderer } from "./wordpressShortcodes";

function applicationBlock(
  names: string[],
  attributes: WordPressShortcodeAttributes,
  children: ReactNode,
) {
  return (
    <ApplicationShortcodeOverrideProvider names={names} attributes={attributes}>
      <div className="my-6 rounded-3xl border border-zinc-200/70 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 sm:p-6">
        {children}
      </div>
    </ApplicationShortcodeOverrideProvider>
  );
}

export const APPLICATION_SHORTCODE_RENDERERS: Record<string, WordPressShortcodeRenderer> = {
  cart: (attributes) => applicationBlock(["funkycommerce_cart", "woocommerce_cart"], attributes, <CartMockupPage />),
  checkout: (attributes) => applicationBlock(["funkycommerce_checkout", "woocommerce_checkout"], attributes, <CheckoutMockupPage />),
  wishlist: (attributes) => applicationBlock(["funkycommerce_wishlist"], attributes, <WishlistMockupPage />),
  reading_list: (attributes) => applicationBlock(["funkycommerce_reading_list"], attributes, <ReadingListMockupPage />),
  account: (attributes) => applicationBlock(["funkycommerce_account", "woocommerce_my_account"], attributes, <AccountMockupPage />),
  auth: (attributes) => {
    const mode = ["login", "register", "forgot-password"].includes(attributes.mode)
      ? attributes.mode as AuthMode
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
