import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateCmsTailwindContent } from "./generate-cms-tailwind-content.mjs";

test("writes the curated baseline when the optional CMS query is forbidden", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-"));
  const outputPath = join(directory, "cms-content.html");

  try {
    const result = await generateCmsTailwindContent({
      endpoint: "https://cms.example.com/graphql",
      outputPath,
      fetchImpl: async () => new Response("", { status: 403 }),
    });

    assert.ok(result.classes.length > 0);
    assert.match(await readFile(outputPath, "utf8"), /Generated stable CMS Tailwind contract/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("contract-only generation never queries CMS content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-"));
  const outputPath = join(directory, "cms-content.html");
  let fetchCount = 0;

  try {
    const result = await generateCmsTailwindContent({
      endpoint: "https://cms.example.com/graphql",
      outputPath,
      auditCms: false,
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error("must not fetch");
      },
    });

    assert.equal(fetchCount, 0);
    assert.ok(result.classes.includes("lg:grid-cols-3"));
    assert.deepEqual(result.dynamic, []);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("fails a required CMS extraction when the query is forbidden", async () => {
  await assert.rejects(
    generateCmsTailwindContent({
      endpoint: "https://cms.example.com/graphql",
      fetchImpl: async () => new Response("", { status: 403 }),
      requireCms: true,
    }),
    /CMS Tailwind content query failed: HTTP 403/,
  );
});

test("sends the storefront origin when querying an origin-protected CMS", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-origin-"));
  const outputPath = join(directory, "cms-content.html");
  let requestOrigin = "";

  try {
    await generateCmsTailwindContent({
      endpoint: "https://cms.example.com/graphql",
      siteUrl: "https://store.example.com/community",
      outputPath,
      fetchImpl: async (_url, init) => {
        requestOrigin = new Headers(init?.headers).get("Origin") || "";
        return Response.json({
          data: {
            contentNodes: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });
      },
    });

    assert.equal(requestOrigin, "https://store.example.com");
  } finally {
    await rm(directory, { recursive: true });
  }
});
