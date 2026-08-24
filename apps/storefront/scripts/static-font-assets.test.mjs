import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { localizeStaticFontAssets } from "./static-font-assets.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

test("downloads remote WordPress fonts and preloads only default family faces", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "storefront-fonts-"));
  temporaryDirectories.push(outputDirectory);
  const requested = [];
  const woff2 = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(28, 7)]);
  const result = await localizeStaticFontAssets(`
    @font-face{font-family:"Display";font-style:normal;font-weight:400;src:url("https://cms.test/display.woff2") format("woff2")}
    @font-face{font-family:"Body";font-style:normal;font-weight:400;src:url("https://cms.test/body.woff2") format("woff2")}
    @font-face{font-family:"Body";font-style:italic;font-weight:400;src:url("https://cms.test/body-italic.woff2") format("woff2")}
  `, {
    outputDirectory,
    fetchImpl: async (url) => {
      requested.push(url);
      return new Response(woff2, { headers: { "content-type": "font/woff2" } });
    },
  });

  assert.equal(requested.length, 3);
  assert.doesNotMatch(result.css, /https:\/\/cms\.test/);
  assert.equal(result.fontAssets.length, 3);
  assert.equal(result.preloadAssets.length, 1);
  for (const { href } of result.fontAssets) {
    const stored = await readFile(join(outputDirectory, href));
    assert.deepEqual(stored, woff2);
  }
});

test("rejects non-font responses instead of publishing untrusted bytes", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "storefront-fonts-"));
  temporaryDirectories.push(outputDirectory);
  await assert.rejects(
    localizeStaticFontAssets(
      '@font-face{font-family:"Body";src:url("https://cms.test/not-a-font.woff2")}',
      {
        outputDirectory,
        fetchImpl: async () => new Response("not a font"),
      },
    ),
    /not a valid WOFF, WOFF2, OTF, or TTF/,
  );
});
