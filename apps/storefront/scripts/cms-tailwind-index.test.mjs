import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

import {
  buildIncrementalTailwindIndex,
  fetchChangedTailwindSources,
  fetchPreviousTailwindSourceIndex,
  fetchTailwindSourceInventory,
  signedTailwindSourceRequest,
  validateTailwindSourceIndex,
} from "./cms-tailwind-index.mjs";

const apiUrl = "https://cms.example.com/wp-json/funkycommerce-tailwind/v1";
const siteUrl = "https://storefront.example.com";
const signingSecret = "s".repeat(32);
const version = (value) => createHash("sha256").update(value).digest("hex");

const source = (id, type, sourceVersion, content) => ({
  key: `${type}:${id}`,
  id,
  type,
  version: sourceVersion,
  content,
  excerpt: "",
  menuClasses: [],
});

const indexPayload = (sources, generatedAt = "2026-09-24T12:00:00.000Z") => {
  const dynamic = [...new Set(Object.values(sources).flatMap((entry) => entry.classes))].sort();
  return {
    schemaVersion: 1,
    extractionRevision: 2,
    generatedAt,
    sourceCount: Object.keys(sources).length,
    classCount: dynamic.length,
    sha256: createHash("sha256").update(dynamic.join("\n")).digest("hex"),
    sources,
  };
};

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

async function withOutput(run) {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-index-"));
  try {
    return await run({
      outputPath: join(directory, ".tailwind/cms-content.html"),
      indexOutputPath: join(directory, "public/.well-known/funkycommerce-tailwind-index.json"),
    });
  } finally {
    await rm(directory, { recursive: true });
  }
}

test("bootstrap fetches bounded source batches and publishes dynamic classes", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const requests = [];
    const firstVersion = version("page-7-v1");
    const secondVersion = version("block-9-v1");
    const fetchImpl = async (url, options = {}) => {
      requests.push({ url, options });
      if (url === `${siteUrl}/.well-known/funkycommerce-tailwind-index.json`) {
        return new Response("", { status: 404 });
      }
      const body = JSON.parse(options.body);
      if (url.endsWith("/inventory")) {
        return jsonResponse({
          schemaVersion: 1,
          cursor: 0,
          nextCursor: 9,
          hasMore: false,
          sources: [
            { key: "page:7", id: 7, type: "page", version: firstVersion },
            { key: "wp_block:9", id: 9, type: "wp_block", version: secondVersion },
          ],
        });
      }
      assert.deepEqual(body.ids, [7, 9]);
      return jsonResponse({
        schemaVersion: 1,
        sources: [
          source(7, "page", firstVersion, '<div class="bg-fuchsia-600 md:grid-cols-7 cms-card"></div>'),
          source(9, "wp_block", secondVersion, '<!-- wp:group {"className":"bg-[#ED225D]"} -->'),
        ],
      });
    };

    const result = await buildIncrementalTailwindIndex({
      apiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      fetchImpl,
      generatedAt: Date.parse("2026-09-24T13:00:00.000Z"),
      allowBootstrap: true,
    });

    assert.deepEqual(result.dynamic, ["bg-[#ED225D]", "bg-fuchsia-600", "md:grid-cols-7"]);
    assert.deepEqual(result.metrics, {
      inventoryRequests: 1,
      sourceRequests: 1,
      changedSources: 2,
      reusedSources: 0,
      deletedSources: 0,
    });

    assert.equal(requests.length, 3);
    assert.match(await readFile(outputPath, "utf8"), /bg-fuchsia-600/);
    const writtenIndex = JSON.parse(await readFile(indexOutputPath, "utf8"));
    assert.equal(writtenIndex.sourceCount, 2);
    assert.deepEqual(writtenIndex.sources["wp_block:9"].classes, ["bg-[#ED225D]"]);
    const compiled = await postcss([
      tailwindcss({
        content: [{ raw: await readFile(outputPath, "utf8"), extension: "html" }],
        darkMode: "class",
      }),
    ]).process("@tailwind utilities;", { from: undefined });
    assert.match(compiled.css, /\.bg-fuchsia-600/);
    assert.match(compiled.css, /\.bg-\\\[\\#ED225D\\\]/);
    assert.match(compiled.css, /\.md\\:grid-cols-7/);
  });
});

test("missing deployed index requires the explicit bootstrap flag", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    await assert.rejects(
      buildIncrementalTailwindIndex({
        apiUrl,
        signingSecret,
        siteUrl,
        outputPath,
        indexOutputPath,
        fetchImpl: async () => new Response("", { status: 404 }),
      }),
      /CMS_TAILWIND_BOOTSTRAP/,
    );
  });

});

test("bootstrap resumes from a validated local index without refetching source bodies", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const sourceVersion = version("page-7-v1");
    await mkdir(dirname(indexOutputPath), { recursive: true });
    await writeFile(indexOutputPath, JSON.stringify(indexPayload({
      "page:7": { version: sourceVersion, classes: ["bg-fuchsia-600"] },
    })));

    const result = await buildIncrementalTailwindIndex({
      apiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      allowBootstrap: true,
      fetchImpl: async (url) => {
        if (url.includes(".well-known")) return new Response("", { status: 404 });
        if (url.endsWith("/inventory")) {
          return jsonResponse({
            schemaVersion: 1,
            cursor: 0,
            nextCursor: 7,
            hasMore: false,
            sources: [
              { key: "attachment:6", id: 6, type: "attachment", version: version("attachment-6") },
              { key: "page:7", id: 7, type: "page", version: sourceVersion },
            ],
          });
        }
        throw new Error("resumed sources must not be fetched");
      },
    });

    assert.equal(result.metrics.sourceRequests, 0);
    assert.equal(result.metrics.reusedSources, 1);
    assert.deepEqual(Object.keys(result.index.sources), ["page:7"]);
  });
});

test("warm build reuses unchanged records without fetching content", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const sourceVersion = version("page-7-v1");
    const previous = indexPayload({
      "page:7": { version: sourceVersion, classes: ["bg-fuchsia-600"] },
    });

    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      if (url.includes(".well-known")) return jsonResponse(previous);
      if (url.endsWith("/inventory")) {
        return jsonResponse({
          schemaVersion: 1,
          cursor: 0,
          nextCursor: 7,
          hasMore: false,
          sources: [{ key: "page:7", id: 7, type: "page", version: sourceVersion }],
        });
      }
      throw new Error("unchanged content must not be fetched");
    };

    const result = await buildIncrementalTailwindIndex({
      apiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      fetchImpl,
    });
    assert.equal(requests.length, 2);
    assert.equal(result.metrics.sourceRequests, 0);
    assert.equal(result.metrics.reusedSources, 1);
    assert.deepEqual(result.dynamic, ["bg-fuchsia-600"]);
  });
});

test("extractor policy upgrades reindex unchanged sources", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const sourceVersion = version("page-7-v1");
    const previous = {
      ...indexPayload({
        "page:7": { version: sourceVersion, classes: ["bg-gradient-to-r"] },
      }),
      extractionRevision: 1,
    };
    const result = await buildIncrementalTailwindIndex({
      apiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      fetchImpl: async (url, options = {}) => {
        if (url.includes(".well-known")) return jsonResponse(previous);
        if (url.endsWith("/inventory")) {
          return jsonResponse({
            schemaVersion: 1,
            cursor: 0,
            nextCursor: 7,
            hasMore: false,
            sources: [{ key: "page:7", id: 7, type: "page", version: sourceVersion }],
          });
        }
        assert.deepEqual(JSON.parse(options.body).ids, [7]);
        return jsonResponse({
          schemaVersion: 1,
          sources: [
            source(
              7,
              "page",
              sourceVersion,
              '<div class="bg-gradient-to-r from-[#7C3AED] to-[#66E0FF]"></div>',
            ),
          ],
        });
      },
    });

    assert.equal(result.metrics.changedSources, 1);
    assert.equal(result.metrics.reusedSources, 0);
    assert.equal(result.index.extractionRevision, 2);
    assert.equal(result.index.sources["page:7"].extractionRevision, 2);
    assert.deepEqual(result.dynamic, [
      "bg-gradient-to-r",
      "from-[#7C3AED]",
      "to-[#66E0FF]",
    ]);
  });
});

test("incremental build replaces changed records and removes deleted sources", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const previousVersion = version("page-7-v1");
    const nextVersion = version("page-7-v2");
    const previous = indexPayload({
      "page:7": { version: previousVersion, classes: ["bg-fuchsia-600"] },
      "post:8": { version: version("post-8-v1"), classes: ["text-rose-600"] },
    });

    const fetchImpl = async (url, options = {}) => {
      if (url.includes(".well-known")) return jsonResponse(previous);
      if (url.endsWith("/inventory")) {
        return jsonResponse({
          schemaVersion: 1,
          cursor: 0,
          nextCursor: 7,
          hasMore: false,
          sources: [{ key: "page:7", id: 7, type: "page", version: nextVersion }],
        });
      }
      assert.deepEqual(JSON.parse(options.body).ids, [7]);
      return jsonResponse({
        schemaVersion: 1,
        sources: [source(7, "page", nextVersion, '<div class="lg:grid-cols-7"></div>')],
      });
    };

    const result = await buildIncrementalTailwindIndex({
      apiUrl,
      signingSecret,
      siteUrl,
      outputPath,
      indexOutputPath,
      fetchImpl,
    });
    assert.equal(result.metrics.changedSources, 1);
    assert.equal(result.metrics.deletedSources, 1);
    assert.deepEqual(result.dynamic, ["lg:grid-cols-7"]);
    assert.deepEqual(Object.keys(result.index.sources), ["page:7"]);
  });
});

test("inventory advances its cursor and changed sources use sequential ten-item batches", async () => {
  const inventoryRequests = [];
  let inventoryCooldowns = 0;
  const firstVersion = version("page-2");
  const secondVersion = version("page-3");
  const inventory = await fetchTailwindSourceInventory({
    apiUrl,
    signingSecret,
    sleepImpl: async () => {
      inventoryCooldowns += 1;
    },
    fetchImpl: async (_url, options) => {
      const { cursor, limit } = JSON.parse(options.body);
      assert.equal(limit, 100);
      inventoryRequests.push(cursor);
      return cursor === 0
        ? jsonResponse({
            schemaVersion: 1,
            cursor: 0,
            nextCursor: 2,
            hasMore: true,
            sources: [
              { key: "attachment:1", id: 1, type: "attachment", version: version("attachment-1") },
              { key: "page:2", id: 2, type: "page", version: firstVersion },
            ],
          })
        : jsonResponse({
            schemaVersion: 1,
            cursor: 2,
            nextCursor: 3,
            hasMore: false,
            sources: [{ key: "page:3", id: 3, type: "page", version: secondVersion }],
          });
    },
  });
  assert.deepEqual(inventoryRequests, [0, 2]);
  assert.equal(inventoryCooldowns, 1);
  assert.equal(inventory.requestCount, 2);
  assert.deepEqual(inventory.sources.map(({ key }) => key), ["page:2", "page:3"]);

  const changedSources = Array.from({ length: 11 }, (_, offset) => ({
    key: `page:${offset + 1}`,
    id: offset + 1,
    type: "page",
    version: version(`page-${offset + 1}`),
  }));
  const batches = [];
  let sourceCooldowns = 0;
  const changed = await fetchChangedTailwindSources({
    changedSources,
    apiUrl,
    signingSecret,
    sleepImpl: async () => {
      sourceCooldowns += 1;
    },
    fetchImpl: async (_url, options) => {
      const { ids } = JSON.parse(options.body);
      batches.push(ids);
      return jsonResponse({
        schemaVersion: 1,
        sources: ids.map((id) =>
          source(id, "page", version(`page-${id}`), `<div class="z-[${id}]"></div>`)),
      });
    },
  });
  assert.deepEqual(batches, [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [11],
  ]);
  assert.equal(changed.requestCount, 2);
  assert.equal(changed.records.size, 11);
  assert.equal(sourceCooldowns, 1);
});

test("invalid or oversized deployed indexes fail before CMS source requests", async () => {
  assert.throws(
    () => validateTailwindSourceIndex(indexPayload({
      "page:1": { version: version("page-1"), classes: ["not-a-tailwind-token"] },
    })),
    /invalid classes/,
  );
  await assert.rejects(
    fetchPreviousTailwindSourceIndex({
      indexUrl: `${siteUrl}/.well-known/funkycommerce-tailwind-index.json`,
      fetchImpl: async () => new Response("{}", {
        headers: { "content-length": String(2 * 1024 * 1024 + 1) },
      }),
    }),
    /response limit/,
  );
});

test("stale source responses fail without writing partial build output", async () => {
  await withOutput(async ({ outputPath, indexOutputPath }) => {
    const inventoryVersion = version("page-7-v2");
    await assert.rejects(
      buildIncrementalTailwindIndex({
        apiUrl,
        signingSecret,
        siteUrl,
        outputPath,
        indexOutputPath,
        allowBootstrap: true,
        fetchImpl: async (url) => {
          if (url.includes(".well-known")) return new Response("", { status: 404 });
          if (url.endsWith("/inventory")) {
            return jsonResponse({
              schemaVersion: 1,
              cursor: 0,
              nextCursor: 7,
              hasMore: false,
              sources: [{ key: "page:7", id: 7, type: "page", version: inventoryVersion }],
            });
          }
          return jsonResponse({
            schemaVersion: 1,
            sources: [source(7, "page", version("stale"), '<div class="bg-fuchsia-600"></div>')],
          });
        },
      }),
      /invalid or stale source/,
    );
    await assert.rejects(access(outputPath), { code: "ENOENT" });
    await assert.rejects(access(indexOutputPath), { code: "ENOENT" });
  });
});

test("signed source requests match the existing artifact HMAC format", async () => {
  let observed;
  const payload = { cursor: 0, limit: 500 };
  await signedTailwindSourceRequest({
    apiUrl,
    path: "inventory",
    payload,
    signingSecret,
    now: 1_700_000_000_000,
    eventId: "tailwind-test",
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return jsonResponse({
        schemaVersion: 1,
        cursor: 0,
        nextCursor: 0,
        hasMore: false,
        sources: [],
      });
    },
  });
  const body = JSON.stringify(payload);
  const expected = createHmac("sha256", signingSecret)
    .update(`1700000000.tailwind-test.${body}`)
    .digest("hex");
  assert.equal(observed.options.headers["x-superfunky-signature"], expected);
  assert.equal(observed.options.headers["x-superfunky-timestamp"], "1700000000");
  assert.equal(observed.options.headers["x-superfunky-event-id"], "tailwind-test");
});

test("only transient failures retry and successful requests have no artificial delay", async () => {
  let requests = 0;
  let delays = 0;
  const result = await signedTailwindSourceRequest({
    apiUrl,
    path: "inventory",
    payload: { cursor: 0, limit: 500 },
    signingSecret,
    sleepImpl: async () => {
      delays += 1;
    },
    fetchImpl: async () => {
      requests += 1;
      if (requests === 1) return jsonResponse({ message: "busy" }, 503);
      return jsonResponse({
        schemaVersion: 1,
        cursor: 0,
        nextCursor: 0,
        hasMore: false,
        sources: [],
      });
    },
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(requests, 2);
  assert.equal(delays, 1);

  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  let timeoutRequests = 0;
  await assert.rejects(
    signedTailwindSourceRequest({
      apiUrl,
      path: "inventory",
      payload: { cursor: 0, limit: 100 },
      signingSecret,
      fetchImpl: async () => {
        timeoutRequests += 1;
        throw timeout;
      },
      sleepImpl: async () => {
        throw new Error("timeouts must not retry");
      },
    }),
    /timed out after 60 seconds/,
  );
  assert.equal(timeoutRequests, 1);

  await assert.rejects(
    signedTailwindSourceRequest({
      apiUrl,
      path: "inventory",
      payload: { cursor: 0, limit: 500 },
      signingSecret,
      sleepImpl: async () => {
        throw new Error("must not retry");
      },
      fetchImpl: async () => jsonResponse({ message: "invalid" }, 400),
    }),
    /HTTP 400/,
  );
});
