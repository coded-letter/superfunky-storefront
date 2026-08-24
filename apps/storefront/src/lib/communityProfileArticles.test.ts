import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import type { ViteDevServer } from "vite";
import type { getCommunityProfile as GetCommunityProfile } from "./community.ts";

// community.ts (transitively, via @funky/sdk/environment.ts) reads `import.meta.env`
// and expects `window`/`localStorage`, both of which only exist under Vite. Load it
// through Vite's SSR module runner + jsdom, matching stickyPosts.test.ts.
process.env.VITE_GRAPHQL_ENDPOINT = "https://backend.example.test/graphql";

let dom: JSDOM;
let server: ViteDevServer;
let getCommunityProfile: typeof GetCommunityProfile;
const originalFetch = globalThis.fetch;

before(async () => {
  dom = new JSDOM("<main></main>", { url: "https://example.test/community/", pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });

  const { createServer } = await import("vite");
  server = await createServer({
    root: new URL("../../", import.meta.url).pathname,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });
  ({ getCommunityProfile } = await server.ssrLoadModule("/src/lib/community.ts"));
});

after(async () => {
  await server.close();
  dom.window.close();
  globalThis.fetch = originalFetch;
});

function profileResponse(articleLanguage: { code: string } | null) {
  return {
    data: {
      communityProfileByHandle: {
        databaseId: 1,
        name: "Jamie Author",
        nicename: "jamie",
        communityHandle: "jamie",
        description: "",
        avatar: null,
        cover: null,
        communityRole: "collaborator",
        communityProfilePublic: true,
        followerCount: 0,
        followingCount: 0,
        isFollowedByViewer: false,
        relationshipState: "none",
        canAccess: true,
        isLocked: false,
        followers: { nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null } },
        following: { nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null } },
        posts: [],
        followingFeed: [],
        products: [],
        articles: [
          {
            id: "article-1",
            databaseId: 501,
            slug: "hello-world",
            uri: "/hello-world/",
            title: "Hello world",
            excerpt: "An excerpt",
            date: "2025-01-01T00:00:00",
            modified: null,
            featuredImage: null,
            language: articleLanguage,
          },
        ],
      },
    },
  };
}

test("a community profile's articles carry the article's own language code instead of losing it in mapping", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(profileResponse({ code: "PL" })), { status: 200, headers: { "Content-Type": "application/json" } });

  const profile = await getCommunityProfile("jamie", "pl");
  assert.equal(profile?.articles.length, 1);
  // Regression guard: `mapProfileArticle` must propagate `language.code` onto the
  // mapped `PostCardData.languageCode` field. Without it, every multi-language site's
  // community profile "Articles" tab silently filters every article out, because
  // `CommunityProfileMockupPage`'s language filter checks `post.languageCode` and an
  // `undefined` value never matches the active language.
  assert.equal(profile?.articles[0].languageCode, "pl");
});

test("a community profile's articles without language metadata are treated as language-agnostic, not dropped", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(profileResponse(null)), { status: 200, headers: { "Content-Type": "application/json" } });

  const profile = await getCommunityProfile("jamie", "pl");
  assert.equal(profile?.articles.length, 1);
  assert.equal(profile?.articles[0].languageCode, "");
});

test("requesting a different language filters out the profile's other-language articles", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(profileResponse({ code: "EN" })), { status: 200, headers: { "Content-Type": "application/json" } });

  const profile = await getCommunityProfile("jamie", "pl");
  assert.equal(profile?.articles.length, 0);
});
