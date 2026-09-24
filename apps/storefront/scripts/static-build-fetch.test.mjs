import assert from "node:assert/strict";
import test from "node:test";
import { createStaticBuildFetch } from "./static-build-fetch.mjs";
import { createStaticNavigationLoader, hydrateStaticRoutes } from "./static-route-hydration.mjs";

const endpoint = "https://cms.test/graphql";
const query = (variables = {}) => ({
  method: "POST",
  body: JSON.stringify({ query: "query Product($id: ID!) { product(id: $id) { name } }", variables }),
});

test("forty archive loaders share one complete three-page Store API inventory", async () => {
  let requests = 0;
  const request = createStaticBuildFetch(async (input) => {
    requests += 1;
    const page = Number(new URL(input).searchParams.get("page"));
    return Response.json(Array.from({ length: page === 3 ? 3 : 100 }, (_, index) => ({
      id: (page - 1) * 100 + index,
    })), { headers: { "x-wp-totalpages": "3" } });
  }, endpoint);
  const archives = await Promise.all(Array.from({ length: 40 }, async () => {
    const products = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await request(`https://cms.test/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
      assert.equal(response.headers.get("x-wp-totalpages"), "3");
      products.push(...await response.json());
    }
    return products;
  }));
  assert.equal(requests, 3);
  assert.ok(archives.every((products) => products.length === 203 && products.at(-1).id === 202));
});

test("public GraphQL reads coalesce but retain distinct variables and response bodies", async () => {
  let requests = 0;
  const request = createStaticBuildFetch(async (_input, init) => {
    requests += 1;
    return Response.json({ data: { id: JSON.parse(init.body).variables.id } });
  }, endpoint);
  const responses = await Promise.all([request(endpoint, query({ id: 1 })), request(endpoint, query({ id: 1 }))]);
  assert.deepEqual(await responses[0].json(), { data: { id: 1 } });
  assert.deepEqual(await responses[1].json(), { data: { id: 1 } });
  assert.equal(requests, 1);
  assert.deepEqual(await (await request(endpoint, query({ id: 2 }))).json(), { data: { id: 2 } });
  assert.equal(requests, 2);
});

test("unreferenced pagination variables do not cause unchanged catalog metadata to reload", async () => {
  let requests = 0;
  const request = createStaticBuildFetch(async () => {
    requests += 1;
    return Response.json({ data: { terms: [] } });
  }, endpoint);
  for (let page = 0; page < 8; page += 1) {
    await request(endpoint, { method: "POST", body: JSON.stringify({
      query: "query Terms($language: String!) { terms(language: $language) { id } }",
      variables: { language: "en", first: 25, after: `cursor:${page}` },
    }) });
  }
  assert.equal(requests, 1);
});

test("all post taxonomy archives share term directories without mixing languages", async () => {
  let requests = 0;
  const request = createStaticBuildFetch(async () => {
    requests += 1;
    return Response.json([{ id: 1 }]);
  }, endpoint);
  for (let archive = 0; archive < 40; archive += 1) {
    for (const taxonomy of ["categories", "tags"]) {
      await request(`https://cms.test/wp-json/wp/v2/${taxonomy}?lang=en&per_page=100`);
    }
  }
  assert.equal(requests, 2);
  await request("https://cms.test/wp-json/wp/v2/tags?lang=pl&per_page=100");
  assert.equal(requests, 3);
});

for (const status of [200, 400]) test(`HTTP ${status} schema validation failures are reused across route variables, not across queries`, async () => {
  let requests = 0;
  const request = createStaticBuildFetch(async () => {
    requests += 1;
    return Response.json({ errors: [{ message: 'Cannot query field "language" on type "Post".' }] }, { status });
  }, endpoint);
  for (let id = 0; id < 40; id += 1) await request(endpoint, query({ id }));
  assert.equal(requests, 1);
  await request(endpoint, { method: "POST", body: '{"query":"query Other { title }"}' });
  assert.equal(requests, 2);
});

test("timeouts, HTTP failures, resolver errors and partial data are never retained", async () => {
  for (const failure of [
    () => { throw new Error("timed out"); },
    () => Response.json({ error: "busy" }, { status: 503 }),
    () => Response.json({ errors: [{ message: "Database unavailable" }] }),
    () => Response.json({ data: { product: null }, errors: [{ message: "Internal server error" }] }),
  ]) {
    let requests = 0;
    const request = createStaticBuildFetch(async () => {
      requests += 1;
      return requests === 1 ? failure() : Response.json({ data: { ok: true } });
    }, endpoint);
    await request(endpoint, query()).catch((error) => assert.match(error.message, /timed out/));
    assert.deepEqual(await (await request(endpoint, query())).json(), { data: { ok: true } });
    assert.equal(requests, 2);
  }
});

test("mutations, authenticated requests and other endpoints bypass the build cache", async () => {
  for (const [url, init] of [
    [endpoint, { method: "POST", body: '{"query":"mutation Save { save }"}' }],
    [endpoint, { method: "POST", body: '{"query":"query Read { title } mutation Save { save }","operationName":"Save"}' }],
    [endpoint, { ...query(), headers: { Authorization: "Bearer test" } }],
    [endpoint, { ...query(), headers: { Cookie: "session=test" } }],
    [endpoint, { ...query(), headers: { "X-WPGraphQL-Login-Token": "test" } }],
    [endpoint, { ...query(), credentials: "include" }],
    ["https://another.test/graphql", query()],
    ["https://cms.test/wp-json/wc/store/v1/cart", {}],
  ]) {
    let requests = 0;
    const request = createStaticBuildFetch(async () => {
      requests += 1;
      return Response.json({ data: { ok: true } });
    }, endpoint);
    await request(url, init);
    await request(url, init);
    assert.equal(requests, 2);
  }
});

test("new builds do not reuse earlier snapshots and aborted callers cannot read cached data", async () => {
  let requests = 0;
  const backend = async () => Response.json({ data: { revision: ++requests } });
  const firstBuild = createStaticBuildFetch(backend, endpoint);
  await firstBuild(endpoint, query());
  await assert.rejects(firstBuild(endpoint, { ...query(), signal: AbortSignal.abort() }), { name: "AbortError" });
  const secondBuild = createStaticBuildFetch(backend, endpoint);
  assert.deepEqual(await (await secondBuild(endpoint, query())).json(), { data: { revision: 2 } });
});

test("a coalesced caller retains its own abort deadline", { timeout: 1_000 }, async () => {
  const gate = Promise.withResolvers();
  const request = createStaticBuildFetch(() => gate.promise, endpoint);
  const first = request(endpoint, query());
  const controller = new AbortController();
  const second = request(endpoint, { ...query(), signal: controller.signal });
  controller.abort();
  await assert.rejects(second, { name: "AbortError" });
  gate.resolve(Response.json({ data: { ok: true } }));
  assert.deepEqual(await (await first).json(), { data: { ok: true } });
});

test("route hydration runs one loader at a time and stops at the first failed route", async () => {
  let active = 0;
  let peak = 0;
  const visited = [];
  const failure = new Error("GraphQL request timed out");
  await assert.rejects(hydrateStaticRoutes(
    ["/a", "/b", "/broken", "/never"].map((path) => ({ path })),
    async ({ path }) => {
      visited.push(path);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      if (path === "/broken") throw failure;
    },
  ), (error) => {
    assert.match(error.message, /Required route seed failed for \/broken/);
    assert.equal(error.cause, failure);
    return true;
  });
  assert.equal(peak, 1);
  assert.deepEqual(visited, ["/a", "/b", "/broken"]);
});

test("static chrome and hydration share one navigation load per language", async () => {
  const languages = [];
  const load = createStaticNavigationLoader(async (language) => {
    languages.push(language);
    return { navigation: { language }, assistant: null };
  });
  const [chrome, seed] = await Promise.all([load("EN"), load("en")]);
  assert.equal(chrome, seed);
  assert.equal(await load("en"), seed);
  assert.deepEqual(languages, ["en"]);
  assert.deepEqual((await load("pl")).navigation, { language: "pl" });
  assert.deepEqual(languages, ["en", "pl"]);
});

test("a failed navigation load reports its language and is not saved as a successful seed", async () => {
  const cause = new Error("GraphQL request timed out");
  let attempts = 0;
  const load = createStaticNavigationLoader(async () => {
    if (++attempts === 1) throw cause;
    return { navigation: {}, assistant: null };
  });
  await assert.rejects(load("en"), (error) => {
    assert.match(error.message, /Required navigation seed failed for en/);
    assert.equal(error.cause, cause);
    return true;
  });
  await load("en");
  assert.equal(attempts, 2);
});
