import assert from "node:assert/strict";
import test from "node:test";

import {
  canUseHomepageBlogSummary,
  canUseHomepageCommunityFeed,
  resolveBackendDataRequirements,
} from "./backendDataRequirements.ts";

test("managed profiles load only relevant home-page data families", () => {
  assert.deepEqual(resolveBackendDataRequirements("blog", "/", ""), {
    commerce: false,
    blog: true,
    stickyPosts: false,
    community: false,
  });
  assert.deepEqual(resolveBackendDataRequirements("shop", "/", ""), {
    commerce: true,
    blog: false,
    stickyPosts: false,
    community: false,
  });
  assert.deepEqual(resolveBackendDataRequirements("full", "/", ""), {
    commerce: false,
    blog: true,
    stickyPosts: false,
    community: false,
  });
  assert.equal(
    resolveBackendDataRequirements(
      "full",
      "/",
      '<div data-funkycommerce-shortcode="slider" data-type="product"></div>',
    ).commerce,
    true,
  );
  assert.equal(
    resolveBackendDataRequirements(
      "full",
      "/",
      '<div class="wp-block-woocommerce-product-collection"></div>',
    ).commerce,
    true,
  );

  assert.deepEqual(resolveBackendDataRequirements("shell", "/", ""), {
    commerce: false,
    blog: false,
    stickyPosts: false,
    community: false,
  });
  assert.deepEqual(resolveBackendDataRequirements("full", "/shortcodes", ""), {
    commerce: true,
    blog: true,
    stickyPosts: false,
    community: true,
  });
});

test("sticky posts load only when their dedicated shortcode is rendered", () => {
  assert.equal(
    resolveBackendDataRequirements(
      "blog",
      "/",
      '<div data-funkycommerce-shortcode="sticky-posts"></div>',
    ).stickyPosts,
    true,
  );
});

test("generated homepages use lean data only for compatible collection shortcodes", () => {
  assert.equal(
    canUseHomepageCommunityFeed(
      "/",
      '<div data-funkycommerce-shortcode="community-feed"></div>',
    ),
    true,
  );
  assert.equal(
    canUseHomepageCommunityFeed(
      "/",
      '<div data-funkycommerce-shortcode="community-feed"></div><div data-funkycommerce-shortcode="community-members"></div>',
    ),
    false,
  );
  assert.equal(
    canUseHomepageBlogSummary(
      "/en",
      '<div data-funkycommerce-shortcode="slider" data-type="post"></div>',
    ),
    true,
  );
  assert.equal(
    canUseHomepageBlogSummary(
      "/",
      '<div data-funkycommerce-shortcode="categories" data-type="post"></div>',
    ),
    false,
  );
  assert.equal(canUseHomepageBlogSummary("/", ""), false);
  assert.equal(canUseHomepageBlogSummary("/blog", ""), false);
});

test("route and shortcode requirements preserve posts on shops without enabling Woo on blogs", () => {
  assert.equal(resolveBackendDataRequirements("shop", "/blog/example", "").blog, true);
  assert.equal(resolveBackendDataRequirements("blog", "/shop", "").commerce, false);
  assert.equal(
    resolveBackendDataRequirements(
      "shop",
      "/about",
      '<div data-funkycommerce-shortcode="slider" data-type="post"></div>',
    ).blog,
    true,
  );
  assert.equal(
    resolveBackendDataRequirements(
      "shop",
      "/about",
      '<div data-funkycommerce-shortcode="slider" data-type="product"></div>',
    ).commerce,
    true,
  );
  assert.equal(
    resolveBackendDataRequirements(
      "blog",
      "/community-hub",
      '<div data-funkycommerce-shortcode="community-feed"></div>',
    ).community,
    true,
  );
});

test("community routes and shortcodes load independently of commerce profile", () => {
  for (const profile of ["blog", "shop", "shell", "full"] as const) {
    assert.equal(resolveBackendDataRequirements(profile, "/community", "").community, true);
    assert.equal(resolveBackendDataRequirements(profile, "/account", "").community, true);
    assert.equal(
      resolveBackendDataRequirements(
        profile,
        "/about",
        '<div data-funkycommerce-shortcode="community-feed"></div>',
      ).community,
      true,
    );
    assert.equal(
      resolveBackendDataRequirements(
        profile,
        "/moje-konto",
        '<div data-funkycommerce-component="funkycommerce_account"></div>',
      ).community,
      true,
    );
  }
});

test("shortcode markers select defaults and aliases without waking unrelated providers", () => {
  const postSlider = resolveBackendDataRequirements(
    "shop",
    "/about",
    '<div data-funkycommerce-shortcode="slider" data-type="post"></div>',
  );
  assert.equal(postSlider.blog, true);
  assert.equal(postSlider.commerce, false);

  const productDefaults = resolveBackendDataRequirements(
    "shop",
    "/about",
    '<div data-funkycommerce-shortcode="categories"></div><div data-funkycommerce-shortcode="grid"></div>',
  );
  assert.equal(productDefaults.commerce, true);
  assert.equal(productDefaults.blog, false);

  assert.equal(
    resolveBackendDataRequirements(
      "shop",
      "/about",
      '<div data-funkycommerce-shortcode="funkycommerce_blog"></div>',
    ).blog,
    true,
  );
  assert.equal(
    resolveBackendDataRequirements(
      "shop",
      "/about",
      '<div data-funkycommerce-shortcode=\\"funkycommerce_shop\\"></div>',
    ).commerce,
    true,
  );
});
