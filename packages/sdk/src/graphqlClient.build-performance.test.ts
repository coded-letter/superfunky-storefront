import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build-time hydration is bounded without weakening browser request limits", async () => {
  const source = await readFile(new URL("./graphqlClient.ts", import.meta.url), "utf8");

  assert.match(source, /const IS_SERVER = typeof window === "undefined"/);
  assert.match(source, /MAX_CONCURRENT_GRAPHQL_REQUESTS = IS_SERVER \? 6 : 2/);
  assert.match(source, /GRAPHQL_REQUEST_TIMEOUT_MS = IS_SERVER \? 12_000 : 60_000/);
});
