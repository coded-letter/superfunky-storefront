import assert from "node:assert/strict";
import test from "node:test";
import { stableRouteIsAvailable } from "./route-availability.mjs";

const stableRoutes = [
  { path: "/", indexable: true },
  { path: "/shop", indexable: true },
  { path: "/product-brand", indexable: true },
  { path: "/blog", indexable: true },
  { path: "/author", indexable: true },
  { path: "/community", indexable: true },
  { path: "/community-author", indexable: true },
  { path: "/community-tag", indexable: true },
  { path: "/sitemap", indexable: true },
  { path: "/cart", indexable: false },
];

test("simple sites only receive stable routes backed by discovered content", () => {
  const discoveredRoutes = [
    { path: "/article", lang: "pl", type: "Post" },
    { path: "/author/editor", lang: "pl", type: "User" },
  ];
  const routes = stableRoutes.filter((route) =>
    stableRouteIsAvailable(route, discoveredRoutes, "pl"),
  );

  assert.deepEqual(routes.map(({ path }) => path), [
    "/",
    "/blog",
    "/author",
    "/sitemap",
    "/cart",
  ]);
});

test("commerce and community directories require their own localized content", () => {
  const discoveredRoutes = [
    { path: "/product/item", lang: "pl", type: "SimpleProduct" },
    { path: "/community/post", lang: "pl", type: "CommunityPost" },
    { path: "/en/product-brand/acme", lang: "en", type: "ProductBrand" },
    { path: "/en/community/member", lang: "en", type: "CommunityAuthor" },
    { path: "/en/community-tag/news", lang: "en", type: "CommunityTag" },
  ];
  const polishRoutes = stableRoutes.filter((route) =>
    stableRouteIsAvailable(route, discoveredRoutes, "pl"),
  );
  const englishRoutes = stableRoutes.filter((route) =>
    stableRouteIsAvailable(route, discoveredRoutes, "en"),
  );

  assert.deepEqual(polishRoutes.map(({ path }) => path), [
    "/",
    "/shop",
    "/community",
    "/sitemap",
    "/cart",
  ]);
  assert.deepEqual(englishRoutes.map(({ path }) => path), [
    "/",
    "/product-brand",
    "/community-author",
    "/community-tag",
    "/sitemap",
    "/cart",
  ]);
});
