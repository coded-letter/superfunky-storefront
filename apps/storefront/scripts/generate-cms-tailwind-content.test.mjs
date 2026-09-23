import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCmsTailwindContent, fetchCmsTailwindDocuments } from "./generate-cms-tailwind-content.mjs";

const endpoint = "https://cms.example.com/graphql";
const emptyConnection = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
function fixtureResponse(query) {
  if (query.includes("StorefrontTailwindLanguages")) return { data: { languages: [{ code: "PL", slug: "pl" }] } };
  if (query.includes("StorefrontTailwindChrome")) return { data: { funkycommerceStorefrontConfig: {
    branding: { promoHtml: '<div class="w-[751px]"></div>' },
    footer: { extraHtml: '<div class="w-[752px]"></div>', copyrightText: "", themeCredit: "", newsletterPrivacyLabel: "" },
  } } };
  const root = query.match(/(\w+)\(first: 50/)?.[1];
  assert.ok(root, query);
  return { data: { [root]: emptyConnection } };
}
async function withOutput(run) {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-"));
  try { await run(join(directory, "cms-content.html")); }
  finally { await rm(directory, { recursive: true }); }
}

test("collects paginated content, product, taxonomy, media and shared chrome with Origin", async () => {
  await withOutput(async (outputPath) => {
    const requests = [];
    const result = await generateCmsTailwindContent({
      endpoint, environment: {}, siteUrl: "https://store.example.com/community", outputPath,
      fetchImpl: async (_url, init) => {
        assert.equal(new Headers(init.headers).get("Origin"), "https://store.example.com");
        const { query, variables } = JSON.parse(init.body);
        requests.push({ query, variables });
        const response = fixtureResponse(query);
        const root = query.match(/(\w+)\(first: 50/)?.[1];
        const nodes = {
          pages: [{ id: "page", content: '<div class="sm:w-7/12"></div>', headlessContent: '<div class="min-h-[500px]"></div>' }],
          posts: [{ id: "post", content: '<div class="font-extrabold"></div>', headlessContent: null, excerpt: "" }],
          communityPosts: [{ id: "community", content: "", description: '<div class="w-[753px]"></div>' }],
          products: [{ id: "product", description: '<div class="w-[754px]"></div>', shortDescription: '<div class="w-[755px]"></div>', headlessDescription: '<div class="w-[756px]"></div>', headlessShortDescription: '<div class="w-[757px]"></div>' }],
          categories: [{ id: "category", description: '<div class="w-[758px]"></div>' }],
          mediaItems: [{ id: "media", caption: '<div class="w-[759px]"></div>', description: "" }],
          menuItems: [{ id: "menu", description: '<div class="w-[760px]"></div>', cssClasses: ["w-[761px]"] }],
        };
        if (nodes[root]) response.data[root] = { ...emptyConnection, nodes: nodes[root] };
        if (root === "pages" && !variables.after) response.data.pages.pageInfo = { hasNextPage: true, endCursor: "page-2" };
        if (root === "pages" && variables.after) response.data.pages.nodes = [{ id: "second", content: '<div class="w-[762px]"></div>', headlessContent: "" }];
        return Response.json(response);
      },
    });
    for (const token of ["sm:w-7/12", "min-h-[500px]", "font-extrabold", ...Array.from({ length: 12 }, (_, i) => `w-[${751 + i}px]`)]) {
      assert.ok(result.classes.includes(token), token);
    }
    assert.ok(requests.some(({ variables }) => variables.after === "page-2"));
    assert.ok(requests.some(({ variables }) => variables.language === "pl"));
    assert.match(await readFile(outputPath, "utf8"), /Generated CMS Tailwind inventory/);
  });
});

test("schema compatibility removes only known optional fields and absent plugin connections", async () => {
  const documents = await fetchCmsTailwindDocuments(endpoint, async (url, init) => {
    if (url.includes("/wp-json/")) return Response.json({ code: "rest_no_route" }, { status: 404 });
    const { query } = JSON.parse(init.body);
    if (query.includes("headlessContent")) return Response.json({ errors: [{ message: 'Cannot query field "headlessContent" on type "Page".' }] });
    if (query.includes("products(first:")) return Response.json({ errors: [{ message: 'Cannot query field "products" on type "RootQuery".' }] });
    if (query.includes("pages(first:")) return Response.json({ data: { pages: { ...emptyConnection, nodes: [{ id: "page", content: '<div class="sm:w-7/12"></div>' }] } } });
    return Response.json(fixtureResponse(query));
  });
  assert.ok(documents.some(({ html }) => html.includes("sm:w-7/12")));
});

test("missing configuration and failed CMS extraction cannot reuse a stale inventory", async () => {
  await withOutput(async (outputPath) => {
    for (const options of [
      { endpoint: "", environment: {} },
      { endpoint, fetchImpl: async () => Response.json({ errors: [{ message: "Access denied" }] }) },
    ]) {
      await writeFile(outputPath, '<div class="stale"></div>');
      await assert.rejects(generateCmsTailwindContent({ environment: {}, outputPath, ...options }), /requires VITE_GRAPHQL_ENDPOINT|Access denied/);
      await assert.rejects(readFile(outputPath), { code: "ENOENT" });
    }
  });
});

test("offline generation is explicit, never fetches, and cannot bypass required mode", async () => {
  await withOutput(async (outputPath) => {
    const result = await generateCmsTailwindContent({
      endpoint, environment: {}, outputPath, offline: true,
      fetchImpl: async () => { throw new Error("must not fetch"); },
    });
    assert.ok(result.classes.includes("lg:grid-cols-3"));
    await assert.rejects(generateCmsTailwindContent({
      endpoint, outputPath, offline: true, environment: { CMS_TAILWIND_REQUIRED: "true" },
    }), /cannot run offline/);
  });
});

test("incomplete responses, cyclic pagination, partial errors and size limits fail closed", async () => {
  for (const [payload, message] of [
    [{ data: { pages: { nodes: [] } } }, /pagination metadata/],
    [{ data: { pages: { ...emptyConnection, nodes: [null] } } }, /invalid node/],
    [{ data: { pages: { ...emptyConnection, nodes: [{ id: "page", content: "" }] } } }, /omitted its HTML/],
    [{ data: { pages: emptyConnection }, errors: [{ message: "Partial resolver failure" }] }, /Partial resolver failure/],
    [{ data: { pages: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "next" } } } }, /incomplete page/],
    [{ data: { pages: { nodes: [{ id: "page", content: "", headlessContent: "" }], pageInfo: { hasNextPage: true, endCursor: "same" } } } }, /invalid cursor/],
    [{ data: { pages: { ...emptyConnection, nodes: [{ id: "page", content: "\u0119".repeat(25_000_001), headlessContent: "" }] } } }, /50 MB/],
  ]) {
    await assert.rejects(fetchCmsTailwindDocuments(endpoint, async () => Response.json(payload)), message);
  }
});

test("network failures retry and then fail rather than generating the baseline", async () => {
  let attempts = 0;
  await assert.rejects(fetchCmsTailwindDocuments(endpoint, async () => {
    attempts += 1;
    return new Response("", { status: 403 });
  }), /HTTP 403/);
  assert.equal(attempts, 3);
});

test("excessive pagination fails instead of emitting a truncated inventory", async () => {
  let pages = 0;
  await assert.rejects(fetchCmsTailwindDocuments(endpoint, async () => Response.json({
    data: { pages: {
      nodes: [{ id: "page", content: "", headlessContent: "" }],
      pageInfo: { hasNextPage: true, endCursor: String(++pages) },
    } },
  })), /pagination exceeded 100 pages/);
  assert.equal(pages, 100);
});

test("known plugin resolver failures use complete product and language fallback data", async () => {
  let productPages = 0;
  const documents = await fetchCmsTailwindDocuments(endpoint, async (url, init) => {
    if (url.includes("/wp-json/")) {
      productPages += 1;
      return Response.json([{ id: productPages, description: `<div class="w-[${770 + productPages}px]"></div>`, short_description: "" }], {
        headers: { "x-wp-totalpages": "2" },
      });
    }
    const { query, variables } = JSON.parse(init.body);
    if (query.includes("products(first:") || query.includes("StorefrontTailwindLanguages")) {
      return Response.json({ errors: [{ message: "Internal server error", extensions: { debugMessage: "Cannot access offset of type string on string" } }] }, { status: 500 });
    }
    if (query.includes("StorefrontTailwindConfigLanguages")) return Response.json({ data: { funkycommerceStorefrontConfig: { languages: [{ code: "pl" }] } } });
    if (query.includes("StorefrontTailwindChrome") && variables.language) assert.equal(variables.language, "pl");
    return Response.json(fixtureResponse(query));
  });
  assert.equal(productPages, 2);
  assert.ok(documents.some(({ html }) => html.includes("w-[772px]")));
  assert.ok(documents.some(({ source }) => source.startsWith("chrome/pl/")));
});

test("a valid empty CMS emits the baseline and invalid Store API pagination is fatal", async () => {
  await withOutput(async (outputPath) => {
    const result = await generateCmsTailwindContent({
      endpoint, outputPath, environment: {},
      fetchImpl: async (_url, init) => {
        const { query } = JSON.parse(init.body);
        const response = fixtureResponse(query);
        if (query.includes("StorefrontTailwindChrome")) response.data.funkycommerceStorefrontConfig = {
          branding: { promoHtml: "" }, footer: { extraHtml: "", copyrightText: "", themeCredit: "", newsletterPrivacyLabel: "" },
        };
        return Response.json(response);
      },
    });
    assert.ok(result.classes.includes("2xl:container"));
  });
  await assert.rejects(fetchCmsTailwindDocuments(endpoint, async (url, init) => {
    if (url.includes("/wp-json/")) return Response.json([]);
    const { query } = JSON.parse(init.body);
    if (query.includes("products(first:")) return Response.json({ errors: [{ message: 'Cannot query field "products" on type "RootQuery".' }] });
    return Response.json(fixtureResponse(query));
  }), /invalid or excessive pagination/);
});
