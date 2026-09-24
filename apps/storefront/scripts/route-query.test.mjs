import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConfiguredFrontPageQuery,
  buildCoreRoutesQuery,
  buildRoutesQuery,
} from "./route-query.mjs";

test("dependency-free sitemap discovery uses only core and theme route fields", () => {
  const query = buildRoutesQuery();

  assert.match(query, /contentNodes\(first: 25/);
  assert.match(query, /\.\.\. on Page \{/);
  assert.match(query, /databaseId\s+slug\s+isFrontPage/);
  assert.match(query, /headlessContent/);
  assert.doesNotMatch(query, /ExternalProduct|ProductCategory|PostTypeSEO|TaxonomySEO/);
  assert.doesNotMatch(query, /isShopPage/);
  assert.doesNotMatch(query, /language \{ code \}|translations/);
});

test("configured front page discovery resolves an omitted page directly by database ID", () => {
  const query = buildConfiguredFrontPageQuery({
    publicRobots: true,
    specialPages: true,
    shopPages: true,
    seo: true,
  });

  assert.match(query, /query StorefrontConfiguredFrontPage\(\$databaseId: ID!\)/);
  assert.match(query, /page\(id: \$databaseId, idType: DATABASE_ID\)/);
  assert.match(query, /databaseId\s+slug\s+isFrontPage\s+isPrivacyPage\s+isShopPage\s+isTermsPage/);
  assert.match(query, /funkycommercePublicRobots/);
  assert.match(query, /StorefrontPostTypeRouteSeo/);
});

test("shop sitemap discovery adds WooCommerce routes without optional SEO or language fields", () => {
  const query = buildRoutesQuery({ commerce: true });

  for (const type of ["Product", "ProductCategory"]) {
    assert.match(query, new RegExp(type));
  }
  assert.match(query, /__typename/);
  assert.doesNotMatch(query, /PostTypeSEO|TaxonomySEO|language \{ code \}/);
});

test("full sitemap discovery retains multilingual and SEO metadata", () => {
  const query = buildRoutesQuery({
    commerce: true,
    multilingual: true,
    publicRobots: true,
    specialPages: true,
    shopPages: true,
    seo: true,
  });

  assert.match(query, /PostTypeSEO/);
  assert.match(query, /TaxonomySEO/);
  assert.match(query, /funkycommercePublicRobots \{ noindex nofollow \}/);
  assert.match(query, /isPrivacyPage\s+isShopPage\s+isTermsPage/);
  assert.match(query, /translations \{ databaseId uri language \{ code \} \}/);
  assert.match(query, /\.\.\. on VariableProduct \{ language \{ code \} \}/);
});

test("core fallback paginates standard routes without the generic connections", () => {
  const query = buildCoreRoutesQuery({ publicRobots: true, specialPages: true, shopPages: true, seo: true });

  for (const connection of ["pages", "posts", "categories", "tags", "users"]) {
    assert.match(query, new RegExp(`${connection}\\(first: 25`));
  }
  assert.match(query, /pages\(first: 25[\s\S]*databaseId\s+slug\s+isFrontPage/);
  assert.doesNotMatch(query, /contentNodes|terms\(/);
  assert.match(query, /PostTypeSEO|TaxonomySEO/);
  assert.match(query, /isPrivacyPage\s+isShopPage\s+isTermsPage/);
  assert.equal(query.match(/funkycommercePublicRobots/g)?.length, 2);
});

test("core fallback can isolate a connection when combined resolvers fail", () => {
  const query = buildCoreRoutesQuery({ connections: ["posts"] });

  assert.match(query, /posts\(first: 25/);
  for (const connection of ["pages", "categories", "tags", "users"]) {
    assert.doesNotMatch(query, new RegExp(`${connection}\\(first: 25`));
  }
});

test("generic route discovery can isolate one bounded connection", () => {
  const query = buildRoutesQuery({ connections: ["terms"], commerce: true });

  assert.match(query, /query StorefrontBuildRoutes\(\$termAfter: String\)/);
  assert.match(query, /terms\(first: 25/);
  assert.doesNotMatch(query, /contentNodes\(first:/);
  assert.doesNotMatch(query, /users\(first:/);
  assert.doesNotMatch(query, /\$contentAfter|\$userAfter|StorefrontPostTypeRouteSeo/);
});

test("isolated SEO taxonomy discovery emits its referenced image fragment", () => {
  const query = buildRoutesQuery({ connections: ["terms"], seo: true });

  assert.match(query, /fragment StorefrontRouteImage on MediaItem/);
  assert.match(query, /fragment StorefrontTaxonomyRouteSeo on TaxonomySEO/);
  assert.match(query, /opengraphImage \{ \.\.\.StorefrontRouteImage \}/);
});
