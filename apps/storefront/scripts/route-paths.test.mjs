import assert from "node:assert/strict";
import test from "node:test";
import {
  cmsRouteFromNode,
  normalizedRoutePath,
  normalizeLanguageRoutePath,
  prerenderRouteDirectoryPath,
} from "./route-paths.mjs";

test("prerender writes encoded localized routes to deployable Unicode directories", () => {
  assert.equal(
    prerenderRouteDirectoryPath(
      "/ja/category/%E3%82%AA%E3%83%BC%E3%82%B7%E3%83%A3%E3%83%B3%EF%BC%86%E3%82%AE%E3%82%A2/",
    ),
    "ja/category/オーシャン＆ギア",
  );
  assert.equal(prerenderRouteDirectoryPath("/category/ocean-gear/"), "category/ocean-gear");
});

test("prerender directory paths cannot decode into traversal or nested segments", () => {
  assert.equal(prerenderRouteDirectoryPath("/category/ocean%2Fgear/"), "category/ocean%2Fgear");
  assert.throws(() => prerenderRouteDirectoryPath("/category/%2E%2E/"), /invalid route path/);
  assert.throws(() => prerenderRouteDirectoryPath("/category/%E0%A4%A/"), /invalid route path/);
});

test("prerender includes backend-provided custom taxonomy URIs", () => {
  const categoryRoute = cmsRouteFromNode(
    { __typename: "ProductCategory", name: "Plugins", uri: "/pro-category/plugins/" },
    "terms",
    "pl",
  );
  assert.deepEqual(
    {
      path: categoryRoute?.path,
      lang: categoryRoute?.lang,
      title: categoryRoute?.title,
      description: categoryRoute?.description,
      source: categoryRoute?.source,
      type: categoryRoute?.type,
      indexable: categoryRoute?.indexable,
    },
    {
      path: "/pro-category/plugins",
      lang: "pl",
      title: "Plugins | FunkyCommerce",
      description: "Discover this product or collection on FunkyCommerce.",
      source: "cms",
      type: "ProductCategory",
      indexable: true,
    },
  );
  assert.equal(
    cmsRouteFromNode(
      { __typename: "ProductTag", name: "Summer sale", uri: "/pro-tag/summer-sale/" },
      "terms",
    )?.path,
    "/pro-tag/summer-sale",
  );
});

test("prerender includes every routable WooCommerce product type", () => {
  for (const type of ["SimpleProduct", "VariableProduct", "ExternalProduct", "GroupProduct"]) {
    const route = cmsRouteFromNode(
      { __typename: type, title: `${type} title`, uri: `/product/${type.toLowerCase()}/` },
      "contentNodes",
    );
    assert.equal(route?.path, `/product/${type.toLowerCase()}`);
    assert.equal(route?.type, type);
    assert.equal(route?.indexable, true);
  }
});

test("prerender emits posts at the canonical storefront blog route", () => {
  const postRoute = cmsRouteFromNode(
    {
      __typename: "Post",
      title: "Custom WP plugins and their compatibility",
      slug: "custom-wp-plugins-and-their-compatibility",
      uri: "/custom-wp-plugins-and-their-compatibility/",
      seo: {
        breadcrumbs: [
          { text: "Home", url: "https://cms.example.test/" },
          {
            text: "Custom WP plugins and their compatibility",
            url: "https://cms.example.test/custom-wp-plugins-and-their-compatibility/",
          },
        ],
      },
    },
    "contentNodes",
    "en",
    ["en"],
  );
  assert.equal(postRoute?.path, "/blog/custom-wp-plugins-and-their-compatibility");
  assert.equal(postRoute?.redirectFrom, "/custom-wp-plugins-and-their-compatibility");
  assert.equal(
    cmsRouteFromNode(
      {
        __typename: "Post",
        title: "Story",
        slug: "story",
        uri: "/story/",
        seo: { breadcrumbs: [{ text: "Story", url: "https://cms.example.test/story/" }] },
      },
      "contentNodes",
      "en",
      ["en"],
    )?.breadcrumbs.at(-1)?.url,
    "/blog/story",
  );
  assert.equal(
    cmsRouteFromNode(
      {
        __typename: "Post",
        title: "Wtyczki",
        slug: "wtyczki",
        uri: "/pl/wtyczki/",
        language: { code: "PL" },
      },
      "contentNodes",
      "en",
      ["en", "pl"],
    )?.path,
    "/pl/blog/wtyczki",
  );
});

test("prerender preserves canonical multilingual CMS URIs", () => {
  assert.equal(
    cmsRouteFromNode(
      { __typename: "Page", title: "Cart", uri: "/en/cart/", language: { code: "EN" } },
      "contentNodes",
      "en",
      ["en", "pl"],
    )?.path,
    "/en/cart",
  );
  const pageRoute = cmsRouteFromNode(
    { __typename: "Page", title: "Koszyk", uri: "/koszyk/", language: { code: "PL" } },
    "contentNodes",
    "en",
    ["en", "pl"],
  );
  assert.deepEqual(
    {
      path: pageRoute?.path,
      lang: pageRoute?.lang,
      title: pageRoute?.title,
      description: pageRoute?.description,
      source: pageRoute?.source,
      type: pageRoute?.type,
      indexable: pageRoute?.indexable,
    },
    {
      path: "/koszyk",
      lang: "pl",
      title: "Koszyk | FunkyCommerce",
      description: "Explore this page on FunkyCommerce.",
      source: "cms",
      type: "Page",
      indexable: true,
    },
  );
});

test("prerender restores a posts page URI from its slug", () => {
  const route = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Blog",
      slug: "blog",
      uri: null,
      language: null,
    },
    "contentNodes",
    "pl",
    ["pl", "en", "ja"],
  );

  assert.equal(route?.path, "/blog");
  assert.equal(route?.lang, "pl");
});

test("prerender gives equivalent multilingual home pages distinct language-root paths", () => {
  const languages = ["pl", "en"];
  const polishHome = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Home - Polski",
      slug: "home-polski",
      uri: "/",
      isFrontPage: true,
      language: { code: "PL" },
    },
    "contentNodes",
    "pl",
    languages,
  );
  const englishHome = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Home",
      slug: "home",
      uri: "/",
      isFrontPage: true,
      language: { code: "EN" },
    },
    "contentNodes",
    "pl",
    languages,
  );

  assert.equal(polishHome?.path, "/");
  assert.equal(polishHome?.lang, "pl");
  assert.equal(polishHome?.canonical, "/");
  assert.equal(englishHome?.path, "/en");
  assert.equal(englishHome?.lang, "en");
  assert.equal(englishHome?.canonical, "/en");
  assert.equal(
    cmsRouteFromNode(
      { __typename: "Page", title: "Home", uri: "/", isFrontPage: true, language: { code: "EN" } },
      "contentNodes",
      "en",
      ["en"],
    )?.path,
    "/",
  );
});

test("prerender rejects a root page that is not the configured static front page", () => {
  assert.equal(
    cmsRouteFromNode(
      { __typename: "Page", title: "Unrelated", uri: "/", isFrontPage: false, language: { code: "EN" } },
      "contentNodes",
      "en",
      ["en", "pl"],
    ),
    null,
  );
});

test("prerender maps complete CMS metadata and always prefers the featured image", () => {
  const route = cmsRouteFromNode(
    {
      __typename: "Post",
      title: "Fallback title",
      uri: "/journal/metadata/",
      date: "2026-08-01T10:00:00Z",
      modified: "2026-08-02T10:00:00Z",
      featuredImage: {
        node: {
          sourceUrl: "https://cms.example.test/featured.webp",
          altText: "Featured artwork",
          mimeType: "image/webp",
          mediaDetails: { width: 1600, height: 900 },
        },
      },
      seo: {
        title: "SEO title",
        metaDesc: "Authoritative description",
        metaKeywords: "metadata, seo",
        canonical: "https://cms.example.test/journal/metadata/",
        metaRobotsNoindex: "index",
        metaRobotsNofollow: "follow",
        opengraphAuthor: "Jane Editor",
        opengraphImage: { sourceUrl: "https://cms.example.test/stale-social.jpg" },
        opengraphTitle: "Social title",
        schema: { articleType: ["Article"], pageType: ["WebPage"] },
      },
    },
    "contentNodes",
  );

  assert.equal(route?.title, "SEO title");
  assert.equal(route?.description, "Authoritative description");
  assert.equal(route?.canonical, "/blog/metadata");
  assert.equal(route?.image?.url, "https://cms.example.test/featured.webp");
  assert.deepEqual(route?.image, {
    url: "https://cms.example.test/featured.webp",
    alt: "Featured artwork",
    type: "image/webp",
    width: 1600,
    height: 900,
  });
  assert.equal(route?.opengraphPublishedTime, "2026-08-01T10:00:00Z");
  assert.equal(route?.opengraphModifiedTime, "2026-08-02T10:00:00Z");
  assert.equal(route?.schemaType, "Article");
  assert.equal(route?.indexable, true);
});

test("prerender preserves explicit CMS noindex metadata on generated pages", () => {
  const route = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Private",
      uri: "/private/",
      seo: { metaRobotsNoindex: "noindex", metaRobotsNofollow: "nofollow" },
    },
    "contentNodes",
  );

  assert.equal(route?.robots, "noindex, nofollow");
  assert.equal(route?.indexable, false);
});

test("explicit public robots override backend-global Yoast noindex metadata", () => {
  const publicRoute = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Community",
      uri: "/community/",
      seo: { metaRobotsNoindex: "noindex", metaRobotsNofollow: "follow" },
      funkycommercePublicRobots: { noindex: false, nofollow: false },
    },
    "contentNodes",
  );
  const lowValueRoute = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Low value",
      uri: "/low-value/",
      seo: { metaRobotsNoindex: "index", metaRobotsNofollow: "follow" },
      funkycommercePublicRobots: { noindex: true, nofollow: false },
    },
    "contentNodes",
  );

  assert.equal(publicRoute?.robots, "index, follow");
  assert.equal(publicRoute?.robotsSource, "explicit");
  assert.equal(lowValueRoute?.robots, "noindex, follow");
  assert.equal(lowValueRoute?.indexable, false);
});

test("public product brand and tag archives ignore inherited backend noindex metadata", () => {
  for (const [type, uri] of [
    ["ProductBrand", "/brand/coded-letter/"],
    ["ProductTag", "/product-tag/sale/"],
  ]) {
    const route = cmsRouteFromNode(
      {
        __typename: type,
        name: "Public archive",
        uri,
        seo: { metaRobotsNoindex: "noindex", metaRobotsNofollow: "follow" },
        funkycommercePublicRobots: { noindex: true, nofollow: false },
      },
      "terms",
    );
    assert.equal(route?.robots, "index, follow");
    assert.equal(route?.robotsSource, "public-commerce-archive");
    assert.equal(route?.indexable, true);
  }
});

test("prerender keeps the public homepage indexable when WordPress is hidden", () => {
  const route = cmsRouteFromNode(
    {
      __typename: "Page",
      title: "Home",
      uri: "/",
      isFrontPage: true,
      seo: { metaRobotsNoindex: "noindex", metaRobotsNofollow: "nofollow" },
    },
    "contentNodes",
  );

  assert.equal(route?.robots, "index, follow");
  assert.equal(route?.indexable, true);
});

test("prerender route cardinality controls prefixes for 0, 1, and 2 languages", () => {
  for (const path of ["/cart", "/checkout", "/pro-category/plugins", "/pro-tag/sale", "/documentation"]) {
    assert.equal(normalizeLanguageRoutePath(path, "en", []), path);
    assert.equal(normalizeLanguageRoutePath(path, "en", ["en"]), path);
    assert.equal(normalizeLanguageRoutePath(path, "en", ["en", "ja"]), `/en${path}`);
    assert.equal(normalizeLanguageRoutePath(path, "ja", ["en", "ja"]), `/ja${path}`);
  }
  assert.equal(normalizeLanguageRoutePath("/en/cart", "en", ["en"]), "/cart");
  assert.equal(normalizeLanguageRoutePath("/de/about", "en", ["en"]), "/de/about");
});

test("prerender preserves nested and encoded canonical taxonomy paths", () => {
  assert.equal(normalizedRoutePath("/pro-category/software/extensions/"), "/pro-category/software/extensions");
  assert.equal(normalizedRoutePath("/pro-tag/caf%C3%A9/"), "/pro-tag/caf%C3%A9");
  assert.equal(normalizedRoutePath("/pro-tag/a%2Fb/"), "/pro-tag/a%2Fb");
});
