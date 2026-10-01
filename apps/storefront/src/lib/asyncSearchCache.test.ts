import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncSearchCache } from "./asyncSearchCache.ts";

test("deduplicates concurrent searches and briefly caches successful results", async () => {
  let calls = 0;
  const cache = createAsyncSearchCache<string[]>({ ttlMs: 1000 });
  const load = async () => {
    calls += 1;
    await Promise.resolve();
    return ["result"];
  };

  const [first, second] = await Promise.all([
    cache("en:coat", load),
    cache("en:coat", load),
  ]);
  assert.deepEqual(first, ["result"]);
  assert.deepEqual(second, ["result"]);
  assert.deepEqual(await cache("en:coat", load), ["result"]);
  assert.equal(calls, 1);
});

test("does not cache failed searches", async () => {
  let calls = 0;
  const cache = createAsyncSearchCache<string[]>({ ttlMs: 1000 });
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary");
    return ["result"];
  };

  await assert.rejects(cache("en:coat", load), /temporary/);
  assert.deepEqual(await cache("en:coat", load), ["result"]);
  assert.equal(calls, 2);
});

test("expires results and bounds its memory use", async () => {
  let now = 0;
  const cache = createAsyncSearchCache<string>({ ttlMs: 10, maxEntries: 1, now: () => now });
  const load = (value: string) => async () => value;

  assert.equal(await cache("one", load("first")), "first");
  assert.equal(await cache("two", load("second")), "second");
  assert.equal(await cache("one", load("reloaded")), "reloaded");
  now = 20;
  assert.equal(await cache("one", load("expired")), "expired");
});
