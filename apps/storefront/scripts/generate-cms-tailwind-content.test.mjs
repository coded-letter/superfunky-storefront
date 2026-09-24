import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateCmsTailwindContent } from "./generate-cms-tailwind-content.mjs";

test("generates the reviewed Tailwind contract without CMS access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tailwind-contract-"));
  const outputPath = join(directory, "cms-content.html");

  try {
    const result = await generateCmsTailwindContent({ outputPath });
    assert.ok(result.classes.includes("lg:grid-cols-3"));
    assert.equal(result.rejected.length, 0);
    assert.match(await readFile(outputPath, "utf8"), /Generated stable CMS Tailwind contract/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
