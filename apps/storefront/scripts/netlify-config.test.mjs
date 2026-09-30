import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateNetlifyHeaders, validateNetlifyRedirects } from "./netlify-config.mjs";

test("validates and preserves raw Netlify redirect rules", () => {
  const rules = "# custom routes\n/old-path  /new-path  301!\n/shop/*  https://shop.example/:splat  302  Country=US\n";
  assert.equal(validateNetlifyRedirects(rules), rules);
  assert.equal(validateNetlifyRedirects(""), "");
});

test("rejects malformed, oversized, and control-character redirect rules", () => {
  assert.throws(() => validateNetlifyRedirects("old-path /new-path 301"), /source path and destination/);
  assert.throws(() => validateNetlifyRedirects("/old /new nope"), /invalid redirect status/);
  assert.throws(() => validateNetlifyRedirects(`/old /new 301\n${"x".repeat(4097)}`), /4 KB line limit/);
  assert.throws(() => validateNetlifyRedirects(`/old /new 301\n${"x".repeat(66_000)}`), /64 KB limit/);
  assert.throws(() => validateNetlifyRedirects("/old /new 301\u0000"), /control characters/);
});

test("validates raw Netlify headers in path blocks", () => {
  const headers = "/*\n  X-Frame-Options: SAMEORIGIN\n  Cache-Control: public, max-age=0\n/private/*\n  X-Robots-Tag: noindex\n";
  assert.equal(validateNetlifyHeaders(headers), headers);
  assert.equal(validateNetlifyHeaders(""), "");
  assert.throws(() => validateNetlifyHeaders("  X-Frame-Options: DENY"), /following a path/);
  assert.throws(() => validateNetlifyHeaders("/private\nX-Robots-Tag: noindex"), /path beginning with \//);
  assert.throws(() => validateNetlifyHeaders("/private\n  Bad Header: nope"), /indented header/);
});

test("static generation validates and merges backend rules with generated Netlify files", async () => {
  const source = await readFile(new URL("./prerender.mjs", import.meta.url), "utf8");
  assert.match(source, /staticGenerationConfig\.netlifyRedirects = validateNetlifyRedirects/);
  assert.match(source, /staticGenerationConfig\.netlifyHeaders = validateNetlifyHeaders/);
  const customRedirects = source.indexOf("...staticGenerationConfig.netlifyRedirects.split");
  const spaFallback = source.indexOf('"/*  /index.html  200"', customRedirects);
  assert.ok(customRedirects >= 0 && spaFallback > customRedirects, "custom redirects must precede the SPA fallback");
  assert.match(source, /"X-Frame-Options"/, "generated baseline security headers must remain present");
  assert.match(source, /\.\.\.staticGenerationConfig\.netlifyHeaders\.split/);
  assert.match(source, /resolve\(outputDirectory, "_redirects"\)/);
  assert.match(source, /resolve\(outputDirectory, "_headers"\)/);
});
