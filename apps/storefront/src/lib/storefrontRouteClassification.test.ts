import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPageRouteKeys,
  resolveRoutePageUri,
  type RoutePageNode,
} from "./storefrontRouteClassification.ts";

function page(overrides: Partial<RoutePageNode>): RoutePageNode {
  return {
    uri: "/example/",
    slug: "example",
    language: { code: "EN" },
    ...overrides,
  };
}

test("front page identity takes precedence over embedded application shortcodes", () => {
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/",
      slug: "home",
      isFrontPage: true,
      headlessShortcodes: [
        "[community-feed layout=\"masonry\"]",
        "[funkycommerce_wishlist]",
      ],
    })),
    ["home"],
  );
});

test("multi-purpose shortcode showcase pages are not canonical application routes", () => {
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/en/test/",
      slug: "test",
      headlessShortcodes: [
        "[funkycommerce_wishlist card_variant=\"default\"]",
        "[funkycommerce_reading_list layout=\"cards\"]",
        "[funkycommerce_auth mode=\"login\" layout=\"split\"]",
      ],
    })),
    [],
  );
});

test("dedicated shortcode-backed routes remain discoverable", () => {
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/shop/",
      slug: "shop",
      headlessShortcodes: ["[product_archive]"],
    })),
    ["shop"],
  );
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/journal/",
      slug: "journal",
      headlessShortcodes: ["[funkycommerce_blog]"],
    })),
    ["blog"],
  );
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/ja/journal/",
      slug: "journal",
      headlessShortcodes: [
        "[slider type=\"post\" slides=\"3\"]",
        "[grid type=\"post\" paginated=\"true\" page_size=\"6\"]",
        "[categories type=\"post\"]",
      ],
    })),
    ["blog"],
  );
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/community/",
      slug: "community",
      headlessShortcodes: [
        "[community-hero layout=\"gradient\"]",
        "[community-feed layout=\"masonry\"]",
        "[grid type=\"community-article\"]",
      ],
    })),
    ["community"],
  );
  assert.deepEqual(
    classifyPageRouteKeys(page({
      uri: "/register/",
      slug: "register",
      headlessShortcodes: ["[funkycommerce_auth mode=\"register\" layout=\"split\"]"],
    })),
    ["auth-register"],
  );
});

test("a WordPress posts page without a URI falls back to its canonical slug", () => {
  assert.equal(resolveRoutePageUri(page({ uri: null, slug: "blog" })), "/blog/");
  assert.equal(resolveRoutePageUri(page({ uri: null, slug: null })), null);
  assert.equal(resolveRoutePageUri(page({ uri: "/en/blog-2/", slug: "blog-2" })), "/en/blog-2/");
});

test("legal special pages are included in the shared route registry", () => {
  assert.deepEqual(classifyPageRouteKeys(page({ slug: "privacy-policy", uri: "/polityka-prywatnosci/" })), ["privacy-policy"]);
  assert.deepEqual(classifyPageRouteKeys(page({ slug: "terms-and-conditions", uri: "/warunki/" })), ["terms"]);
});
