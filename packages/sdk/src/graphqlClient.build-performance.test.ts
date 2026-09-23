import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build-time hydration is bounded without weakening browser request limits", async () => {
  const source = await readFile(new URL("./graphqlClient.ts", import.meta.url), "utf8");

  assert.match(source, /const IS_SERVER = typeof window === "undefined"/);
  assert.match(source, /MAX_CONCURRENT_GRAPHQL_REQUESTS = 2/);
  assert.match(source, /GRAPHQL_REQUEST_TIMEOUT_MS = IS_SERVER \? 12_000 : 60_000/);
});

test("parallel build callers never occupy more than two backend workers", async () => {
  const { graphqlRequest } = await import("./graphqlClient.ts");
  const originalFetch = globalThis.fetch;
  let active = 0;
  let peak = 0;
  let requests = 0;
  globalThis.fetch = async () => {
    active += 1;
    peak = Math.max(peak, active);
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return Response.json({ data: { ok: true } });
  };
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      graphqlRequest<{ ok: boolean }>("query WorkerLimit { ok }")));
    assert.equal(peak, 2);
    assert.equal(requests, 8);
    assert.ok(results.every((result) => result.data?.ok));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
