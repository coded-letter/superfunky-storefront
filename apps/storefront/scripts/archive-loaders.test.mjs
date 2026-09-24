import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { createStaticBuildFetch } from "./static-build-fetch.mjs";

let server;
let dom;
let blog;
let authors;
let posts;
let commerce;
let postDetails;
const originalFetch = globalThis.fetch;

before(async () => {
  dom = new JSDOM("<main></main>", { url: "https://storefront.test/" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });
  server = await createServer({
    root: new URL("../", import.meta.url).pathname,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    define: {
      "import.meta.env.VITE_GRAPHQL_ENDPOINT": JSON.stringify("https://cms.test/graphql"),
      "import.meta.env.VITE_BACKEND_PROFILE": JSON.stringify("full"),
    },
  });
  [blog, authors, posts, commerce, postDetails] = await Promise.all([
    server.ssrLoadModule("/src/lib/blog.ts"),
    server.ssrLoadModule("/src/lib/authors.ts"),
    server.ssrLoadModule("/src/lib/postArchives.ts"),
    server.ssrLoadModule("/src/lib/commerce.ts"),
    server.ssrLoadModule("/src/lib/posts.ts"),
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

test("product detail snapshots preserve related cards, variable stock, bodies and every review", async () => {
  const main = {
    ...rawProducts[0], __typename: "VariableProduct",
    description: "<p>Original body</p>", shortDescription: "<p>Short body</p>",
    stockStatus: "OUT_OF_STOCK", stockQuantity: 0, backordersAllowed: false,
  };
  const related = { ...rawProducts[1], description: "<p>Related body</p>", shortDescription: "" };
  const review = (index) => ({ id: `review-${index}`, databaseId: index, content: `Review ${index}`, author: { node: { name: "Alice" } } });
  const detail = {
    ...main, sku: "SKU", language: { code: "EN" },
    headlessDescription: "<section class=\"p-4\">Rendered body</section>",
    headlessShortDescription: "<p>Rendered short body</p>",
    related: { nodes: [related] }, upsell: { nodes: [related] }, crossSell: { nodes: [related] },
    reviews: { nodes: [review(1)], pageInfo: { hasNextPage: true, endCursor: "review:1" } },
  };
  const calls = transport(({ query }) => {
    if (query.includes("query StorefrontProductReviews(")) {
      return { data: { product: { reviews: { nodes: [review(2)], pageInfo: { hasNextPage: false } } } } };
    }
    if (query.includes("engagementRating")) return { data: { product: detail } };
    assert.doesNotMatch(query, /description\(format: RENDERED\)|headlessDescription|galleryImages|engagementRating/);
    assert.match(query, /on VariableProduct\s*\{\s*stockStatus stockQuantity backordersAllowed/);
    assert.match(query, /content\(format: RENDERED\)/);
    return { data: { product: {
      id: main.id, sku: detail.sku, language: detail.language,
      stockStatus: main.stockStatus, stockQuantity: 0, backordersAllowed: false,
      related: { nodes: [{ id: related.id }] }, upsell: { nodes: [{ id: related.id }] }, crossSell: { nodes: [{ id: related.id }] },
      reviews: detail.reviews,
    } } };
  });
  const expected = await commerce.getProductByUriOrSlug(main.slug);
  const { stockStatus, stockQuantity, backordersAllowed, ...listCard } = main;
  const snapshot = new Map([[main.id, listCard], [related.id, related]]);
  const actual = await commerce.getProductByUriOrSlug(main.slug, snapshot, (id) => {
    const node = id === main.id ? detail : related;
    return {
      description: node.description, shortDescription: node.shortDescription,
      ...(node.headlessDescription ? { headlessDescription: node.headlessDescription, headlessShortDescription: node.headlessShortDescription } : {}),
    };
  });
  assert.deepEqual(actual, expected);
  assert.equal(actual.reviews.length, 2);
  assert.equal(actual.card.stockStatus, "OUT_OF_STOCK");
  assert.equal(actual.descriptionHtml, detail.headlessDescription);
  assert.equal(calls.length, 4);
});

test("product detail reloads full cards when a related product is outside the catalog", async () => {
  const detail = { ...rawProducts[0], related: { nodes: [rawProducts[1]] }, upsell: null, reviews: null };
  const calls = transport(({ query }) => ({ data: { product: query.includes("engagementRating")
    ? detail
    : { id: detail.id, related: { nodes: [{ id: rawProducts[1].id }] }, upsell: null, reviews: null },
  } }));
  const actual = await commerce.getProductByUriOrSlug(detail.slug, new Map([[detail.id, detail]]));
  assert.equal(actual.related.length, 1);
  assert.equal(actual.related[0].id, rawProducts[1].id);
  assert.equal(calls.length, 2);
});

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
    let snapshot;
    const result = await commerce.getCommerceCatalog("en", "EN", ["en", "pl"], (products) => { snapshot = products; });
    assert.equal(result.products.length, 203);
    assert.equal(result.products.at(-1).id, "product-202");
    assert.equal(result.hasMoreProducts, false);
    assert.deepEqual(snapshot.map(({ id }) => id), result.products.map(({ id }) => id));
    assert.deepEqual(calls.filter(({ query, variables }) => !variables.skipProducts && query.includes("products(first:")
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

test("build hydration reuses complete Store API inventory across different taxonomy archives", async () => {
  const catalog = Array.from({ length: 125 }, (_, index) => ({
    id: index + 1, name: `Product ${index + 1}`, slug: `product-${index + 1}`,
    permalink: `https://cms.test/product/product-${index + 1}/`,
    categories: [{ id: 1, name: "News", slug: "news" }],
    tags: [{ id: 2, name: "Featured", slug: "featured" }],
  }));
  const calls = transport(() => ({ data: { archive: null } }), () => catalog);
  globalThis.fetch = createStaticBuildFetch(globalThis.fetch, "https://cms.test/graphql");
  const category = await commerce.getProductArchive("category", "news", "SLUG", "en", "EN");
  const tag = await commerce.getProductArchive("tag", "featured", "SLUG", "en", "EN");
  assert.equal(category.products.length, 125);
  assert.equal(tag.products.length, 125);
  assert.equal(tag.products.at(-1).id, "store-api-product:125");
  assert.equal(category.hasMoreProducts, false);
  assert.equal(tag.hasMoreProducts, false);
  assert.deepEqual(calls.filter(({ restPage }) => restPage).map(({ restPage }) => restPage), [1, 2]);
});

test("post hydration reuses extracted bodies without dropping comment content or changing browser queries", async () => {
  const rawPost = {
    id: "post:1", databaseId: 1, slug: "article", uri: "/article/", title: "Article",
    engagementRating: rawProducts[0].engagementRating,
    content: "<p>Fresh browser body</p>", headlessContent: "<p>Fresh browser headless</p>",
    comments: { nodes: [{ id: "comment:1", content: "<p>Comment stays</p>" }], pageInfo: { hasNextPage: false } },
  };
  let buildQuery;
  transport(({ query }) => {
    buildQuery = query;
    const { content, headlessContent, ...metadata } = rawPost;
    return { data: { post: metadata } };
  });

  const result = await postDetails.getPostByUri("/article/", (id) => {
    assert.equal(id, "post:1");
    return { content: "<p>Extracted content</p>", headlessContent: '<p class="w-[751px]">Extracted headless</p>' };
  });
  assert.doesNotMatch(buildQuery, /content\(format: RENDERED\)|\bheadlessContent\b/);
  assert.match(buildQuery, /comments\([\s\S]*\bcontent\b/);
  assert.equal(result.content, '<p class="w-[751px]">Extracted headless</p>');
  assert.match(result.comments[0].content, /Comment stays/);
  transport(({ query }) => {
    assert.match(query, /content\(format: RENDERED\)/);
    assert.match(query, /headlessContent/);
    return { data: { post: rawPost } };
  });
  assert.equal((await postDetails.getPostByUri("/article/")).content, "<p>Fresh browser headless</p>");
});

test("build post-detail batches preserve all 25 posts with 13 initial requests", async () => {
  const fixtures = rawPosts.slice(0, 25).map((post) => ({
    ...post,
    engagementRating: rawProducts[0].engagementRating,
    comments: { nodes: [], pageInfo: { hasNextPage: false } },
    content: `<p>${post.id}</p>`,
    headlessContent: `<section>${post.id}</section>`,
  }));
  const byUri = new Map(fixtures.map((post) => [post.uri, post]));
  const byId = new Map(fixtures.map((post) => [post.id, post]));
  const calls = transport(({ query, variables }) => {
    if (!query.includes("StorefrontBuildPostDetails")) {
      return { data: { post: byUri.get(variables.uri) } };
    }
    assert.ok(Object.keys(variables).length <= 2);
    assert.doesNotMatch(query, /\bheadlessContent\b|content\(format: RENDERED\)/);
    assert.match(query, /comments\([\s\S]*\bcontent\b/);
    return { data: Object.fromEntries(Object.entries(variables).map(([key, uri]) => {
      const { content, headlessContent, ...metadata } = byUri.get(uri);
      assert.match(query, new RegExp(`post${key.slice(3)}: post\\(id: \\$${key}`));
      return [`post${key.slice(3)}`, metadata];
    })) };
  });
  const expected = new Map();
  for (const post of fixtures) expected.set(post.uri, await postDetails.getPostByUri(post.uri));
  calls.length = 0;
  const actual = await postDetails.getPostsByUris(fixtures.map(({ uri }) => uri), (id) => {
    const { content, headlessContent } = byId.get(id);
    return { content, headlessContent };
  });
  assert.deepEqual(actual, expected);
  assert.equal(calls.length, 13);
  assert.equal(actual.size, 25);
});

test("post-detail batches reject omitted aliases instead of dropping routes", async () => {
  transport(() => ({ data: {} }));
  await assert.rejects(postDetails.getPostsByUris(["/missing/"], () => ({ content: "" })), /omitted \/missing\//);
});

for (const localized of [false, true]) test(`catalog-backed ${localized ? "localized" : "unscoped"} product archives retain all 203 products and their exact order`, async () => {
  const ordered = [...rawProducts].reverse();
  const calls = transport((operation) => {
    const identityOnly = operation.query.includes("fragment StorefrontProductListCard on Product { id }");
    const products = connection(identityOnly ? ordered.map(({ id }) => ({ id })) : ordered, operation);
    return { data: {
      archive: { id: "brand", name: "Brand", count: 203, language: { code: "EN" }, products },
      ...(localized ? { localizedProducts: products } : {}),
    } };
  });
  const original = await commerce.getProductArchive("brand", "brand", "SLUG", "en", "EN");
  calls.length = 0;
  const optimized = await commerce.getProductArchive("brand", "brand", "SLUG", "en", "EN",
    new Map(rawProducts.map((product) => [product.id, product])));
  assert.deepEqual(optimized, original);
  assert.equal(optimized.products.length, 203);
  assert.equal(optimized.products.at(-1).id, "product-0");
  assert.equal(optimized.hasMoreProducts, false);
  assert.equal(calls.length, 9);
  for (const { query } of calls) {
    assert.doesNotMatch(query, /engagementRating|galleryImages|variations|shortDescription\(format/);
  }
});

test("a product absent from the build snapshot reloads the complete archive instead of dropping it", async () => {
  const calls = transport(({ query }) => ({ data: {
    archive: {
      id: "brand", name: "Brand",
      products: {
        nodes: query.includes("fragment StorefrontProductListCard on Product { id }")
          ? [{ id: rawProducts[0].id }] : [rawProducts[0]],
        pageInfo: { hasNextPage: false },
      },
    },
  } }));
  const result = await commerce.getProductArchive("brand", "brand", "SLUG", "en", "EN", new Map());
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].id, rawProducts[0].id);
  assert.equal(calls.length, 2);
  assert.match(calls[1].query, /engagementRating/);
});

test("build catalog metadata resolves once and extracted product descriptions preserve the complete browser result", async () => {
  const products = rawProducts.map((product) => ({
    ...product, description: "<p>Complete description</p>", shortDescription: "<p>Short description</p>",
  }));
  const categories = { nodes: [{ id: "category", databaseId: 1, name: "Category", slug: "category", uri: "/category/", description: "Category description" }] };
  const reviews = { nodes: [{ id: "review", content: "Review text", rating: 5, commentedOn: { node: { title: "Product", uri: "/product/" } } }] };
  const calls = transport((operation) => {
    const { query, variables } = operation;
    if (query.includes("query StorefrontCommerceCatalog(")) {
      const hydrated = connection(products, operation);
      const nodes = query.includes("shortDescription(format: RENDERED)")
        ? hydrated.nodes
        : hydrated.nodes.map(({ description, shortDescription, ...product }) => product);
      return { data: {
        ...(!variables.skipProducts ? { products: { ...hydrated, nodes } } : {}),
        ...(!variables.skipMetadata ? { productCategories: categories, reviews } : {}),
      } };
    }
    if (query.includes("productBrands(first:")) return { data: { productBrands: { nodes: [] } } };
    if (query.includes("productTags(first:")) return { data: { productTags: { nodes: [] } } };
    assert.fail(`Unexpected query ${query}`);
  });
  const browser = await commerce.getCommerceCatalog("en", "EN", ["en", "pl"]);
  calls.length = 0;
  const descriptions = new Map(products.map(({ id, description, shortDescription }) => [id, { description, shortDescription }]));
  const build = await commerce.getCommerceCatalog("en", "EN", ["en", "pl"], () => {}, (id) => descriptions.get(id));
  assert.deepEqual(build, browser);
  const catalogCalls = calls.filter(({ query }) => query.includes("query StorefrontCommerceCatalog("));
  assert.equal(catalogCalls.filter(({ variables }) => variables.skipProducts).length, 1);
  assert.equal(catalogCalls.filter(({ variables }) => variables.skipMetadata).length, 9);
  for (const { query } of catalogCalls) {
    assert.match(query, /productCategories[\s\S]*\bdescription\b/);
    assert.match(query, /reviews: comments\([\s\S]*@skip\(if: \$skipMetadata\)/);
    assert.doesNotMatch(query, /description\(format: RENDERED\)|shortDescription\(format: RENDERED\)/);
  }
});
