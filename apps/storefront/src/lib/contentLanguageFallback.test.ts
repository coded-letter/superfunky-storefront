import assert from "node:assert/strict";
import test from "node:test";

import { resolveContentLanguageFallback } from "./contentLanguageFallback.ts";

test("unknown translated routes resolve every candidate and schema in one parallel wave", async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const lookup = (kind: string) => async (uri: string) => {
    started.push(`${kind}:${uri}`);
    if (started.length === 4) release();
    await gate;
    return null;
  };

  assert.equal(await resolveContentLanguageFallback(
    "/en/missing/",
    "en",
    ["en", "ja"],
    { getPage: lookup("page"), getNodeInfo: lookup("node") },
  ), null);
  assert.deepEqual(started, [
    "page:/ja/missing/",
    "node:/ja/missing/",
    "page:/missing/",
    "node:/missing/",
  ]);
});

test("parallel fallback keeps configured candidate priority and real node schemas", async () => {
  const result = await resolveContentLanguageFallback(
    "/en/archive/",
    "en",
    ["en", "ja", "pl"],
    {
      getPage: async () => null,
      getNodeInfo: async (uri) => uri.startsWith("/ja/") ? { type: "Tag" } : { type: "Product" },
    },
  );

  assert.equal(result, "/ja/archive/");
});
