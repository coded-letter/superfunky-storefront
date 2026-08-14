import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import type { ViteDevServer } from "vite";
import type { getStickyPosts as GetStickyPosts, sortStickyPosts as SortStickyPosts } from "./stickyPosts.ts";
import type { RawBlogPost } from "./postArchives.ts";
import type { PostCardData } from "@funky/ui";

// stickyPosts.ts (transitively, via postArchives.ts/graphqlClient.ts/env.ts) reads
// `import.meta.env` and expects `window`/`DOMParser`, both of which only exist under
// Vite. Load it through Vite's SSR module runner + jsdom, matching postArchives.test.ts.
process.env.VITE_GRAPHQL_ENDPOINT = "https://backend.example.test/graphql";

let dom: JSDOM;
let server: ViteDevServer;
let getStickyPosts: typeof GetStickyPosts;
let sortStickyPosts: typeof SortStickyPosts;
const originalFetch = globalThis.fetch;

before(async () => {
  dom = new JSDOM("<main></main>", { url: "https://example.test/blog/", pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });

  const { createServer } = await import("vite");
  server = await createServer({
    root: new URL("../../", import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });
  ({ getStickyPosts, sortStickyPosts } = await server.ssrLoadModule("/src/lib/stickyPosts.ts"));
});

after(async () => {
  await server.close();
  dom.window.close();
  globalThis.fetch = originalFetch;
});

function rawPost(overrides: Partial<RawBlogPost>): RawBlogPost {
  return {
    id: overrides.id || "post-1",
    databaseId: overrides.databaseId ?? 1,
    slug: "post",
    uri: "/post/",
    title: "Post",
    excerpt: "",
    content: "",
    date: "2025-01-01T00:00:00",
    modified: null,
    language: { code: "en" },
    translations: null,
    author: null,
    featuredImage: null,
    categories: null,
    tags: null,
    seo: { readingTime: null, schema: null },
    ...overrides,
  };
}

test("requests published sticky posts scoped to language with a deterministic multi-key GraphQL orderby", async () => {
  let capturedBody: string | undefined;
  globalThis.fetch = async (_url, init) => {
    capturedBody = String(init?.body);
    return new Response(
      JSON.stringify({
        data: {
          posts: {
            nodes: [
              rawPost({ id: "b", databaseId: 2, title: "Beta", date: "2025-01-01T00:00:00" }),
              rawPost({ id: "a", databaseId: 1, title: "Alpha", date: "2025-01-01T00:00:00" }),
              rawPost({ id: "c", databaseId: 3, title: "Gamma", date: "2025-02-01T00:00:00" }),
            ],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const posts = await getStickyPosts("en");

  // Newest publish date first ("c"); the two same-date posts break the tie
  // alphabetically by title ("Alpha" before "Beta").
  assert.deepEqual(posts.map((post) => post.id), ["c", "a", "b"]);

  const request = JSON.parse(capturedBody || "{}");
  assert.equal(request.variables.language, "en");
  assert.match(request.query, /status:\s*PUBLISH/);
  assert.match(request.query, /isSticky:\s*true/);
  assert.match(request.query, /language:\s*\$language/);
  assert.match(request.query, /orderby:\s*\[\s*\{\s*field:\s*DATE,\s*order:\s*DESC\s*\}\s*,\s*\{\s*field:\s*TITLE,\s*order:\s*ASC\s*\}\s*\]/);
});

test("surfaces GraphQL errors instead of silently returning an empty list", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ errors: [{ message: "sticky posts unavailable" }] }), { status: 200 });

  await assert.rejects(() => getStickyPosts("en"), /sticky posts unavailable/);
});

test("returns an empty list — not an error — when there are no published sticky posts", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: { posts: { nodes: [] } } }), { status: 200 });

  const posts = await getStickyPosts("en");
  assert.deepEqual(posts, []);
});

test("sortStickyPosts breaks date ties by title, then by a stable numeric ID", () => {
  const base: PostCardData = {
    id: "x",
    slug: "x",
    title: "X",
    excerpt: "",
    date: "2025-01-01T00:00:00",
    author: { name: "Author" },
    wordCount: 0,
  };

  const posts: PostCardData[] = [
    { ...base, id: "same-title-2", databaseId: 5, title: "Same title", date: "2025-01-01T00:00:00" },
    { ...base, id: "newest", databaseId: 1, title: "Zeta", date: "2025-03-01T00:00:00" },
    { ...base, id: "same-title-1", databaseId: 2, title: "Same title", date: "2025-01-01T00:00:00" },
    { ...base, id: "oldest", databaseId: 3, title: "Alpha", date: "2024-01-01T00:00:00" },
  ];

  const sorted = sortStickyPosts(posts);

  assert.deepEqual(sorted.map((post) => post.id), ["newest", "same-title-1", "same-title-2", "oldest"]);
  // The input array is never mutated in place.
  assert.equal(posts[0].id, "same-title-2");
});
