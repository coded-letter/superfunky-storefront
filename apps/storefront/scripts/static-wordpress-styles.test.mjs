import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { writeStaticWordPressStyleAssets } from "./static-wordpress-styles.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

test("writes deferred custom CSS separately from the critical static stylesheet", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "storefront-static-css-"));
  temporaryDirectories.push(outputDirectory);
  const result = await writeStaticWordPressStyleAssets({
    prefixSections: [".global { color: black; }"],
    suffixSections: [".wp-block { display: block; }"],
    customCss: ".hero { color: red; }\n/* storefront:deferred */\n.below-fold { color: blue; }",
    outputDirectory,
    sourceHash: "source-hash",
  });

  assert.ok(result);
  assert.equal(result.sourceHash, "source-hash");
  assert.match(result.deferredHref, /^\/assets\/wordpress-deferred-[a-f0-9]{16}\.css$/);
  const criticalCss = await readFile(join(outputDirectory, result.href), "utf8");
  const deferredCss = await readFile(join(outputDirectory, result.deferredHref), "utf8");
  assert.match(criticalCss, /\.hero/);
  assert.match(criticalCss, /\.wp-block/);
  assert.doesNotMatch(criticalCss, /\.below-fold/);
  assert.match(deferredCss, /\.below-fold/);
  assert.doesNotMatch(deferredCss, /\.hero/);
});

test("keeps all custom CSS critical when no deferred marker is present", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "storefront-static-css-"));
  temporaryDirectories.push(outputDirectory);
  const result = await writeStaticWordPressStyleAssets({
    prefixSections: [],
    suffixSections: [],
    customCss: ".page { color: red; }",
    outputDirectory,
    sourceHash: "source-hash",
  });

  assert.ok(result);
  assert.equal(result.deferredHref, "");
  assert.match(await readFile(join(outputDirectory, result.href), "utf8"), /\.page/);
});
