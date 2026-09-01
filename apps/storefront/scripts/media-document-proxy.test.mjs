import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prerenderSource = readFileSync(new URL("prerender.mjs", import.meta.url), "utf8");

test("prerender keeps media-library PDF and GLB assets on the storefront production domain", () => {
  assert.match(
    prerenderSource,
    /rewriteStaticProxiedMediaUrls\(normalizeStaticShortcodes\(html, \{ placeholders \}\)\)/,
  );
  assert.match(prerenderSource, /\\s\(href\|src\)=/);
  assert.match(
    prerenderSource,
    /\/wp-content\/uploads\/\*  \$\{new URL\(graphqlEndpoint\)\.origin\}\/wp-content\/uploads\/:splat  200/,
  );
  const proxyIndex = prerenderSource.indexOf("...mediaDocumentProxy");
  const spaIndex = prerenderSource.indexOf('"/*  /index.html  200"');
  assert.ok(proxyIndex > -1 && proxyIndex < spaIndex);
});
