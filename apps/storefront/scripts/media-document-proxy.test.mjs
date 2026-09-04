import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prerenderSource = readFileSync(new URL("prerender.mjs", import.meta.url), "utf8");

test("prerender emits integrity-protected opaque media routes and preserves legacy URLs", () => {
  assert.match(
    prerenderSource,
    /rewriteStaticProxiedMediaUrls\(normalizeStaticShortcodes\(html, \{ placeholders \}\)\)/,
  );
  assert.match(prerenderSource, /\\s\(href\|src\)=/);
  assert.match(prerenderSource, /createHash\("sha256"\)\.update\(mediaUrl\.pathname\)\.digest\("hex"\)/);
  assert.match(prerenderSource, /`\/media\/\$\{integrity\}\/\$\{filename\}`/);
  assert.match(prerenderSource, /existingTarget && existingTarget !== target/);
  assert.match(prerenderSource, /\.\.\.opaqueMediaProxy,\s+\.\.\.mediaDocumentProxy,/);
  assert.match(prerenderSource, /\/wp-content\/uploads\/\*  \$\{new URL\(graphqlEndpoint\)\.origin\}\/wp-content\/uploads\/:splat  200/);
  const proxyIndex = prerenderSource.indexOf("...opaqueMediaProxy");
  const spaIndex = prerenderSource.indexOf('"/*  /index.html  200"');
  assert.ok(proxyIndex > -1 && proxyIndex < spaIndex);
});
