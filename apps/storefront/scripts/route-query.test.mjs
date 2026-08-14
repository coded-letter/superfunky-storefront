import assert from "node:assert/strict";
import test from "node:test";

import { buildCoreRoutesQuery, buildRoutesQuery } from "./route-query.mjs";

test("dependency-free sitemap discovery uses only core and theme route fields", () => {
  const query = buildRoutesQuery();

  assert.match(query, /contentNodes\(first: 100/);
  assert.match(query, /\.\.\. on Page \{/);
  assert.match(query, /headlessContent/);
  assert.doesNotMatch(query, /ExternalProduct|ProductCategory|PostTypeSEO|TaxonomySEO/);
  assert.doesNotMatch(query, /language \{ code \}|translations/);
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
  const query = buildRoutesQuery({ commerce: true, multilingual: true, seo: true });

  assert.match(query, /PostTypeSEO/);
  assert.match(query, /TaxonomySEO/);
  assert.match(query, /translations \{ databaseId \}/);
  assert.match(query, /\.\.\. on VariableProduct \{ language \{ code \} \}/);
});

test("core fallback paginates standard routes without the generic connections", () => {
  const query = buildCoreRoutesQuery({ seo: true });

  for (const connection of ["pages", "posts", "categories", "tags", "users"]) {
    assert.match(query, new RegExp(`${connection}\\(first: 100`));
  }
  assert.doesNotMatch(query, /contentNodes|terms\(/);
  assert.match(query, /PostTypeSEO|TaxonomySEO/);
});

test("core fallback can isolate a connection when combined resolvers fail", () => {
  const query = buildCoreRoutesQuery({ connections: ["posts"] });

  assert.match(query, /posts\(first: 100/);
  for (const connection of ["pages", "categories", "tags", "users"]) {
    assert.doesNotMatch(query, new RegExp(`${connection}\\(first: 100`));
  }
});
