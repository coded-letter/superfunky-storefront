import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("production builds enforce initial JavaScript performance budgets", async () => {
  const source = await readFile(new URL("./audit-performance-budget.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.match(source, /entry\.dynamicImports/);
  assert.match(source, /initialJavaScriptBytes: 1_000_000/);
  assert.match(source, /initialJavaScriptGzipBytes: 300_000/);
  assert.match(source, /initialScriptCount: 8/);
  assert.match(packageJson.scripts.build, /audit-performance-budget\.mjs/);
});
