import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

let server;
let dom;
let blog;
let authors;
let posts;
let commerce;
const originalFetch = globalThis.fetch;

before(async () => {
  dom = new JSDOM("<main></main>", { url: "https://storefront.test/" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });
  server = await createServer({
    root: new URL("../", import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    define: {
      "import.meta.env.VITE_GRAPHQL_ENDPOINT": JSON.stringify("https://cms.test/graphql"),
      "import.meta.env.VITE_BACKEND_PROFILE": JSON.stringify("full"),
    },
  });
  [blog, authors, posts, commerce] = await Promise.all([
    server.ssrLoadModule("/src/lib/blog.ts"),
    server.ssrLoadModule("/src/lib/authors.ts"),
    server.ssrLoadModule("/src/lib/postArchives.ts"),
    server.ssrLoadModule("/src/lib/commerce.ts"),
  ]);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
  dom?.window.close();
});

const rawPosts = Array.from({ length: 203 }, (_, index) => ({
  id: `post-${index}`, databaseId: index + 1, slug: `post-${index}`, uri: `/post-${index}/`,
  title: `Post ${index}`, date: "2026-01-01", content: "", excerpt: "",
  language: { code: index % 5 === 0 ? "PL" : "EN" },
  author: { node: { id: "author", name: "Alice", slug: index % 7 === 0 ? "bob" : "alice", uri: "/author/alice/" } },
}));
const rawProducts = Array.from({ length: 203 }, (_, index) => ({
  __typename: "SimpleProduct", id: `product-${index}`, databaseId: index + 1,
  slug: `product-${index}`, uri: `/product/product-${index}/`, name: `Product ${index}`,
  engagementRating: { average: null, count: 0, guestCount: 0, authoredCount: 0, histogram: [0, 0, 0, 0, 0] },
}));

function transport(graphql, rest = () => []) {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "POST") {
      const operation = JSON.parse(init.body);
      calls.push(operation);
      return Response.json(graphql(operation));
    }
    assert.equal(url.pathname, "/wp-json/wc/store/v1/products");
    assert.equal(url.searchParams.get("per_page"), "100");
    const all = rest();
    const page = Number(url.searchParams.get("page"));
    calls.push({ restPage: page });
    return Response.json(all.slice((page - 1) * 100, page * 100), {
      headers: { "x-wp-totalpages": String(Math.ceil(all.length / 100)) },
    });
  };
  return calls;
}

function connection(nodes, { query, variables }) {
  assert.match(query, /(?:posts|products)\(first: \$first, after: \$after/);
  assert.equal(variables.first, 25);
  const start = variables.after ? Number(variables.after.slice("cursor:".length)) : 0;
  const end = start + variables.first;
  return { nodes: nodes.slice(start, end), pageInfo: { hasNextPage: end < nodes.length, endCursor: `cursor:${end}` } };
}

test("blog indexes fetch every transport page before applying language filtering", async () => {
  const calls = transport((operation) => ({ data: { posts: connection(rawPosts, operation) } }));
  const result = await blog.getBlogData("en", "EN");
  assert.equal(result.posts.length, rawPosts.filter((post) => post.language.code === "EN").length);
  assert.equal(result.posts.at(-1).id, "post-202");
  assert.equal(result.hasMorePosts, false);
  assert.deepEqual(calls.map(({ variables }) => variables.after), [null, ...Array.from({ length: 8 }, (_, index) => `cursor:${(index + 1) * 25}`)]);
});

test("post taxonomy archives keep posts beyond the first transport batch", async () => {
  const calls = transport((operation) => ({ data: {
    archive: { id: "category", name: "News", language: { code: "EN" }, posts: connection(rawPosts, operation) },
    terms: { nodes: [{ id: "category", name: "News", slug: "news", language: { code: "EN" } }] },
  } }));
  const result = await posts.getPostTaxonomyArchive("category", "news", "SLUG", "en");
  assert.equal(result.posts.length, rawPosts.filter((post) => post.language.code === "EN").length);
  assert.equal(result.posts.at(-1).id, "post-202");
  assert.equal(result.hasMorePosts, false);
  assert.equal(calls.length, 9);
});

test("author compatibility retries preserve cursors and client-side author/language filtering", async () => {
  const calls = transport((operation) => {
    if (operation.query.includes("authorName: $authorName")) {
      return { data: null, errors: [{ message: "Cannot access offset of type string on string" }] };
    }
    return { data: {
      user: { id: "author", databaseId: 1, slug: "alice", name: "Alice" },
      posts: connection(rawPosts, operation),
    } };
  });
  const result = await authors.getAuthorArchive("alice", "EN", "en", ["en", "pl"]);
  assert.deepEqual(result.posts.map(({ id }) => id), rawPosts
    .filter((post) => post.author.node.slug === "alice" && post.language.code === "EN").map(({ id }) => id));
  assert.deepEqual(calls.filter(({ query }) => !query.includes("authorName: $authorName"))
    .map(({ variables }) => variables.after), [null, ...Array.from({ length: 8 }, (_, index) => `cursor:${(index + 1) * 25}`)]);
});

for (const compatible of [false, true]) {
  test(`product catalogs retain all pages with ${compatible ? "compatible" : "primary"} GraphQL queries`, async () => {
    const calls = transport((operation) => {
      const { query } = operation;
      if (compatible && query.includes("query StorefrontCommerceCatalog(")) {
        return { data: null, errors: [{ message: 'Cannot query field "language" on type "Product".' }] };
      }
      if (query.includes("products(first:")) return { data: { products: connection(rawProducts, operation) } };
      if (query.includes("productCategories(first:")) return { data: { productCategories: { nodes: [] } } };
      if (query.includes("productBrands(first:")) return { data: { productBrands: { nodes: [] } } };
      if (query.includes("productTags(first:")) return { data: { productTags: { nodes: [] } } };
      if (query.includes("reviews: comments(")) return { data: { reviews: { nodes: [] } } };
      assert.fail(`Unexpected query: ${query}`);
    });
    const result = await commerce.getCommerceCatalog("en", "EN", ["en", "pl"]);
    assert.equal(result.products.length, 203);
    assert.equal(result.products.at(-1).id, "product-202");
    assert.equal(result.hasMoreProducts, false);
    assert.deepEqual(calls.filter(({ query }) => query.includes("products(first:")
      && (!compatible || query.includes("CatalogCompatibleProducts")))
      .map(({ variables }) => variables.after), [null, ...Array.from({ length: 8 }, (_, index) => `cursor:${(index + 1) * 25}`)]);
  });
}

test("localized product taxonomy cursors never switch to the unscoped connection on an empty last page", async () => {
  const calls = transport(({ variables }) => ({ data: {
    archive: {
      id: "brand", name: "Brand", language: { code: "EN" },
      products: { nodes: [rawProducts[202]], pageInfo: { hasNextPage: true, endCursor: "wrong-stream" } },
    },
    localizedProducts: variables.after
      ? { nodes: [], pageInfo: { hasNextPage: false } }
      : { nodes: rawProducts.slice(0, 100), pageInfo: { hasNextPage: true, endCursor: "localized:100" } },
  } }));
  const result = await commerce.getProductArchive("brand", "brand", "SLUG", "en", "EN");
  assert.equal(result.products.length, 100);
  assert.equal(result.hasMoreProducts, false);
  assert.deepEqual(calls.map(({ variables }) => variables.after), [null, "localized:100"]);
});

test("Store API taxonomy fallback paginates beyond 100 products and includes the partial final page", async () => {
  const catalog = Array.from({ length: 125 }, (_, index) => ({
    id: index + 1, name: `Product ${index + 1}`, slug: `product-${index + 1}`,
    permalink: `https://cms.test/product/product-${index + 1}/`,
    categories: [{ id: 1, name: "News", slug: "news" }],
  }));
  const calls = transport(() => ({ data: { archive: null } }), () => catalog);
  const result = await commerce.getProductArchive("category", "news", "SLUG", "en", "EN");
  assert.equal(result.products.length, 125);
  assert.equal(result.products.at(-1).id, "store-api-product:125");
  assert.equal(result.hasMoreProducts, false);
  assert.deepEqual(calls.filter(({ restPage }) => restPage).map(({ restPage }) => restPage), [1, 2]);
});
