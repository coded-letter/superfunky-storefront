import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

let server;
let dom;
let blog;
let archives;
let authors;
const originalFetch = globalThis.fetch;
const originalGlobals = Object.fromEntries(
  ["window", "document", "DOMParser"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);

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
  [blog, archives, authors] = await Promise.all([
    server.ssrLoadModule("/src/lib/blog.ts"),
    server.ssrLoadModule("/src/lib/postArchives.ts"),
    server.ssrLoadModule("/src/lib/authors.ts"),
  ]);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
  dom?.window.close();
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

const posts = Array.from({ length: 203 }, (_, index) => ({
  id: `post-${index}`,
  databaseId: index + 1,
  slug: `post-${index}`,
  uri: `${index % 5 === 0 ? "/pl" : ""}/post-${index}/`,
  title: `Post ${index}`,
  date: "2026-01-01",
  modified: null,
  content: index === 1 ? null : index === 2 ? "" : `<p>${"archive body ".repeat(101 + index)}</p>`,
  excerpt: "<p>Short excerpt</p>",
  language: { code: index % 5 === 0 ? "PL" : "EN" },
  author: { node: {
    id: index % 7 === 0 ? "bob" : "alice",
    name: index % 7 === 0 ? "Bob" : "Alice",
    slug: index % 7 === 0 ? "bob" : "alice",
    uri: "/author/alice/",
  } },
}));
const term = { id: "news", name: "News", slug: "news", uri: "/category/news/", language: { code: "EN" } };
const comment = {
  id: "comment", content: "<p>Comment content stays</p>", date: "2026-01-01",
  author: { node: { name: "Reader" } },
  commentedOn: { node: { title: "Post 202", uri: "/post-202/", language: { code: "EN" } } },
};
const expectedCursors = [null, ...Array.from({ length: 8 }, (_, index) => `cursor:${(index + 1) * 25}`)];

function installTransport(respond) {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://cms.test/graphql");
    assert.equal(init?.method, "POST");
    const operation = JSON.parse(init.body);
    calls.push(operation);
    return Response.json(respond(operation));
  };
  return calls;
}

function connection({ query, variables }, source = posts) {
  assert.match(query, /posts\(first: \$first, after: \$after/);
  assert.equal(variables.first, 25);
  const start = variables.after ? Number(variables.after.slice("cursor:".length)) : 0;
  const end = start + variables.first;
  const hasContent = /^    content\(format: RENDERED\)$/m.test(query);
  return {
    nodes: source.slice(start, end).map(({ content, ...post }) => hasContent ? { ...post, content } : post),
    pageInfo: { hasNextPage: end < source.length, endCursor: `cursor:${end}` },
  };
}

function getter(ids) {
  return (id) => {
    ids.push(id);
    const post = posts.find((node) => node.id === id);
    assert.ok(post, `Missing snapshot ${id}`);
    return { content: post.content, headlessContent: "<p>Do not use this different body for card word counts</p>" };
  };
}

function assertBuildQueries(calls, hasComments = false) {
  for (const { query } of calls) {
    // Exact indentation scopes this assertion to the shared post-card selection.
    assert.doesNotMatch(query, /^    content\(format: RENDERED\)$/m);
    assert.match(query, /excerpt\(format: RENDERED\)/);
    if (hasComments) assert.match(query, /        content\(format: RENDERED\)/);
  }
}

test("blog snapshot cards equal browser cards through the final page and preserve comments", async () => {
  const respond = (operation) => ({ data: {
    posts: connection(operation), categories: { nodes: [term] }, tags: { nodes: [] },
    comments: { nodes: [comment] },
  } });
  const browserCalls = installTransport(respond);
  const expected = await blog.getBlogData("en", "EN");
  assert.equal(browserCalls.length, 9);
  for (const { query } of browserCalls) {
    assert.match(query, /^    content\(format: RENDERED\)$/m);
    assert.match(query, /        content\(format: RENDERED\)/);
  }
  const calls = installTransport(respond);
  const ids = [];
  const actual = await blog.getBlogData("en", "EN", getter(ids));
  assert.deepEqual(actual, expected);
  assert.equal(actual.posts.at(-1).id, "post-202");
  assert.equal(actual.posts.at(-1).wordCount, 606);
  assert.equal(actual.posts.at(-1).readingTimeMinutes, 4);
  assert.equal(actual.comments[0].content, "Comment content stays");
  assert.equal(actual.hasMorePosts, false);
  assert.deepEqual(ids, posts.filter((post) => post.language.code === "EN").map(({ id }) => id));
  assert.deepEqual(calls.map(({ variables }) => variables.after), expectedCursors);
  assertBuildQueries(calls, true);
});

for (const taxonomy of ["category", "tag"]) {
  test(`${taxonomy} snapshots survive URI-to-slug retries and retain final-page card equality`, async () => {
    const respond = (operation) => ({ data: {
      archive: operation.variables.idType === "URI" ? null : {
        ...term, databaseId: 1, posts: connection(operation),
      },
      terms: { nodes: [term] },
    } });
    installTransport(respond);
    const expected = await archives.getPostTaxonomyArchive(taxonomy, `/${taxonomy}/news/`, "URI", "en");
    const calls = installTransport(respond);
    const ids = [];
    const actual = await archives.getPostTaxonomyArchive(taxonomy, `/${taxonomy}/news/`, "URI", "en", getter(ids));
    assert.deepEqual(actual, expected);
    assert.equal(actual.posts.at(-1).id, "post-202");
    assert.equal(actual.posts.at(-1).wordCount, 606);
    assert.equal(actual.hasMorePosts, false);
    assert.deepEqual(ids, actual.posts.map(({ id }) => id));
    assert.equal(calls[0].variables.idType, "URI");
    assert.ok(calls.slice(1).every(({ variables }) => variables.idType === "SLUG" && variables.id === "news"));
    assert.deepEqual(calls.slice(1).map(({ variables }) => variables.after), expectedCursors);
    assertBuildQueries(calls);
  });
}

test("author snapshot cards equal browser cards after author and language filtering", async () => {
  const respond = (operation) => ({ data: {
    user: { id: "alice", databaseId: 1, slug: "alice", name: "Alice" },
    posts: connection(operation),
  } });
  installTransport(respond);
  const expected = await authors.getAuthorArchive("alice", "EN", "en", ["en", "pl"]);
  const calls = installTransport(respond);
  const ids = [];
  const actual = await authors.getAuthorArchive("alice", "EN", "en", ["en", "pl"], getter(ids));
  assert.deepEqual(actual, expected);
  assert.equal(actual.posts.at(-1).id, "post-202");
  assert.equal(actual.posts.at(-1).wordCount, 606);
  assert.deepEqual(ids, posts.filter((post) => post.language.code === "EN" && post.author.node.slug === "alice").map(({ id }) => id));
  assert.deepEqual(calls.map(({ variables }) => variables.after), expectedCursors);
  assertBuildQueries(calls);
});

test("blog compatibility retries on every page keep snapshot bodies out and comments in", async () => {
  const calls = installTransport((operation) => operation.query.includes("readingTime")
    ? { errors: [{ message: 'Cannot query field "seo" on type "Post".' }] }
    : { data: { posts: connection(operation), comments: { nodes: [comment] } } });
  const ids = [];
  const actual = await blog.getBlogData("en", "EN", getter(ids));
  assert.deepEqual(actual.posts, posts.filter((post) => post.language.code === "EN").map(archives.mapBlogPost));
  assert.equal(actual.posts.at(-1).wordCount, 606);
  assert.equal(actual.comments[0].content, "Comment content stays");
  assert.equal(calls.length, 18);
  assert.deepEqual(calls.filter(({ query }) => !query.includes("readingTime")).map(({ variables }) => variables.after), expectedCursors);
  assertBuildQueries(calls, true);
});

test("taxonomy compatibility retries restore bodies through the final transport page", async () => {
  const calls = installTransport((operation) => operation.query.includes("readingTime")
    ? { errors: [{ message: "Cannot access offset of type string on string" }] }
    : { data: {
      archive: { ...term, databaseId: 1, posts: connection(operation) },
      terms: { nodes: [term] },
    } });
  const ids = [];
  const actual = await archives.getPostTaxonomyArchive("category", "news", "SLUG", "en", getter(ids));
  assert.deepEqual(actual.posts, posts.filter((post) => post.language.code === "EN").map(archives.mapBlogPost));
  assert.equal(actual.posts.at(-1).wordCount, 606);
  assert.equal(calls.length, 18);
  assert.deepEqual(calls.filter(({ query }) => !query.includes("readingTime")).map(({ variables }) => variables.after), expectedCursors);
  assertBuildQueries(calls);
});

test("author compatibility retains URI-language and author filtering across all pages", async () => {
  const withoutLanguage = posts.map(({ language, ...post }) => post);
  const calls = installTransport((operation) => operation.query.includes("authorName: $authorName")
    ? { errors: [{ message: "Cannot access offset of type string on string" }] }
    : { data: {
      user: { id: "alice", databaseId: 1, slug: "alice", name: "Alice" },
      posts: connection(operation, withoutLanguage),
    } });
  const ids = [];
  const actual = await authors.getAuthorArchive("alice", "EN", "en", ["en", "pl"], getter(ids));
  const expected = withoutLanguage.filter((post) => !post.uri.startsWith("/pl/") && post.author.node.slug === "alice");
  assert.deepEqual(actual.posts, expected.map(archives.mapBlogPost));
  assert.equal(actual.posts.at(-1).id, "post-202");
  assert.equal(actual.posts.at(-1).wordCount, 606);
  assert.deepEqual(ids, expected.map(({ id }) => id));
  assert.equal(calls.length, 18);
  assert.deepEqual(calls.filter(({ query }) => !query.includes("authorName: $authorName")).map(({ variables }) => variables.after), expectedCursors);
  assertBuildQueries(calls);
});
