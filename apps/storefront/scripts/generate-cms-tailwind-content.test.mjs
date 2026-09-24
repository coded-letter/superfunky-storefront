import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  fetchCmsTailwindManifest,
  generateCmsTailwindContent,
  validateCmsTailwindManifest,
} from "./generate-cms-tailwind-content.mjs";

const createManifest = (classes, overrides = {}) => ({
  schemaVersion: 1,
  complete: true,
  contentRevision: 7,
  generatedAt: "2026-09-24T12:00:00+00:00",
  sourceCount: 3,
  classCount: classes.length,
  sha256: createHash("sha256").update(classes.join("\n")).digest("hex"),
  classes,
  ...overrides,
});

test("contract-only generation never performs a network request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-contract-"));
  const outputPath = join(directory, "cms-content.html");
  let fetchCount = 0;

  try {
    const result = await generateCmsTailwindContent({
      manifestUrl: "https://cms.example.com/cms-tailwind-manifest.json",
      outputPath,
      useManifest: false,
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error("must not fetch");
      },
    });

    assert.equal(fetchCount, 0);
    assert.ok(result.classes.includes("lg:grid-cols-3"));
    assert.deepEqual(result.dynamic, []);
    assert.equal(result.manifest, null);
    assert.match(await readFile(outputPath, "utf8"), /Generated CMS Tailwind contract and static manifest input/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("one static manifest GET adds CMS-specific utilities to Tailwind content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-manifest-"));
  const outputPath = join(directory, "cms-content.html");
  const classes = ["bg-[#ED225D]", "bg-fuchsia-600", "cms-card", "md:grid-cols-7"];
  const manifest = createManifest(classes);
  const requests = [];

  try {
    const result = await generateCmsTailwindContent({
      manifestUrl: "https://cms.example.com/uploads/cms-tailwind-manifest.json",
      outputPath,
      requireManifest: true,
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return Response.json(manifest);
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://cms.example.com/uploads/cms-tailwind-manifest.json");
    assert.equal(requests[0].init.method, "GET");
    assert.equal(requests[0].init.body, undefined);
    assert.equal(requests[0].init.cache, "no-store");
    assert.equal(result.manifest.contentRevision, 7);
    assert.deepEqual(result.dynamic, ["bg-[#ED225D]", "bg-fuchsia-600", "md:grid-cols-7"]);
    assert.ok(!result.classes.includes("cms-card"));
    const source = await readFile(outputPath, "utf8");
    assert.match(source, /bg-\[#ED225D\]/);
    assert.match(source, /bg-fuchsia-600/);
    assert.match(source, /md:grid-cols-7/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("required manifest failures stop before Tailwind compilation", async () => {
  await assert.rejects(
    generateCmsTailwindContent({
      manifestUrl: "https://cms.example.com/cms-tailwind-manifest.json",
      requireManifest: true,
      fetchImpl: async () => new Response("", { status: 503 }),
    }),
    /static manifest returned HTTP 503/,
  );
});

test("optional manifest failures retain the stable local contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cms-tailwind-fallback-"));
  const outputPath = join(directory, "cms-content.html");
  try {
    const result = await generateCmsTailwindContent({
      manifestUrl: "https://cms.example.com/cms-tailwind-manifest.json",
      outputPath,
      requireManifest: false,
      fetchImpl: async () => new Response("", { status: 404 }),
    });
    assert.equal(result.manifest, null);
    assert.ok(result.classes.includes("lg:grid-cols-3"));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("manifest validation rejects unsorted classes and digest drift", () => {
  assert.throws(
    () => validateCmsTailwindManifest(createManifest(["text-red-500", "bg-blue-500"])),
    /unique, sorted/,
  );
  assert.throws(
    () => validateCmsTailwindManifest(createManifest(["bg-blue-500"], { sha256: "0".repeat(64) })),
    /SHA-256/,
  );
});

test("manifest validation rejects the packaged incomplete baseline", () => {
  assert.throws(
    () => validateCmsTailwindManifest(createManifest([], {
      complete: false,
      contentRevision: 0,
    })),
    /not complete/,
  );
});

test("manifest download enforces the declared 1 MiB limit before reading", async () => {
  let bodyRead = false;
  await assert.rejects(
    fetchCmsTailwindManifest(
      "https://cms.example.com/cms-tailwind-manifest.json",
      async () => ({
        ok: true,
        headers: new Headers({ "content-length": String(1024 * 1024 + 1) }),
        arrayBuffer: async () => {
          bodyRead = true;
          return new ArrayBuffer();
        },
      }),
    ),
    /1 MiB/,
  );
  assert.equal(bodyRead, false);
});

test("manifest URL must be credential-free HTTPS", async () => {
  await assert.rejects(
    fetchCmsTailwindManifest("http://cms.example.com/manifest.json", async () => {
      throw new Error("must not fetch");
    }),
    /credential-free HTTPS/,
  );
});
