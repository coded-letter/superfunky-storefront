import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import type { ViteDevServer } from "vite";
import type { mapBlogPost as MapBlogPost, RawBlogPost } from "./postArchives.ts";

// postArchives.ts (transitively, via graphqlClient.ts/env.ts) reads `import.meta.env`
// and expects a `window`, both of which only exist under Vite. We load it through
// Vite's SSR module runner — already a project dependency — instead of plain
// `node --experimental-strip-types`, which can't resolve either.
let dom: JSDOM;
let server: ViteDevServer;
let mapBlogPost: typeof MapBlogPost;

const developerTipsPayload = JSON.parse(
  readFileSync(new URL("../../../../packages/cms/src/fixtures/developerTipsFeaturedImage.json", import.meta.url), "utf8"),
);

before(async () => {
  dom = new JSDOM("<main></main>", { url: "https://example.test/blog/", pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });

  const { createServer } = await import("vite");
  server = await createServer({
    root: new URL("../../", import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });
  ({ mapBlogPost } = await server.ssrLoadModule("/src/lib/postArchives.ts"));
});

after(async () => {
  await server.close();
  dom.window.close();
});

function buildRawPost(overrides: Partial<RawBlogPost>): RawBlogPost {
  return {
    id: "post-1",
    databaseId: 1,
    slug: "developer-tips",
    uri: "/developer-tips/",
    title: "Developer tips",
    excerpt: "",
    content: "",
    date: "2025-02-01",
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

test("mapBlogPost recovers the Developer tips SEO ImageObject when featuredImage edge is null", () => {
  const post = buildRawPost({
    featuredImage: developerTipsPayload.featuredImage,
    seo: { readingTime: 4, schema: developerTipsPayload.seo.schema },
  });

  const mapped = mapBlogPost(post);

  assert.equal(
    mapped.imageUrl,
    "https://v3.superfunky.pro/wp-content/uploads/2025/02/david-pupaza-heNwUmEtZzo-unsplash-e1785794485108.jpg",
  );
});

test("mapBlogPost preserves a normal featuredImage node without falling back to schema", () => {
  const post = buildRawPost({
    featuredImage: {
      node: {
        sourceUrl: "https://cms.example/uploads/working.jpg",
        altText: "Working featured image",
        srcSet: null,
        mediaDetails: { width: 1200, height: 800 },
      },
    },
    seo: {
      readingTime: 3,
      schema: {
        raw: JSON.stringify({
          "@graph": [{ "@type": "ImageObject", contentUrl: "https://cms.example/uploads/fallback.jpg" }],
        }),
      },
    },
  });

  const mapped = mapBlogPost(post);

  assert.equal(mapped.imageUrl, "https://cms.example/uploads/working.jpg");
});

test("mapBlogPost leaves imageUrl undefined when neither featuredImage nor schema resolve", () => {
  const post = buildRawPost({ featuredImage: null, seo: { readingTime: null, schema: { raw: "{" } } });

  const mapped = mapBlogPost(post);

  assert.equal(mapped.imageUrl, undefined);
});
