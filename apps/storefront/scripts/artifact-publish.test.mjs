import assert from "node:assert/strict";
import test from "node:test";

import {
  artifactConfigFromEnvironment,
  artifactProxyRedirects,
  createShellManifest,
  publishShellManifest,
  publishShellManifestForMode,
} from "./artifact-publish.mjs";

const html = '<!doctype html><html lang="en"><head><title>Test</title><meta name="description" content="Test"><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

test("shell manifests contain one of every slot and only public seed routes", () => {
  const manifest = createShellManifest({
    html,
    routes: [
      { path: "/", lang: "en" },
      { path: "/shop", lang: "en" },
      { path: "/checkout", lang: "en" },
      { path: "/assets/app.js", lang: "en" },
    ],
    localeCodes: ["en"],
    siteKey: "superfunky-pro",
    artifactOrigin: "https://v3.superfunky.pro",
    shellVersion: "deploy-123",
  });

  test("stable client-only routes remain on static failover", () => {
    const manifest = createShellManifest({
      html,
      routes: [
        { path: "/", lang: "en", source: "stable" },
        { path: "/shop", lang: "en", source: "stable" },
        { path: "/sitemap", lang: "en", source: "stable" },
        { path: "/product/example", lang: "en", source: "cms" },
      ],
      localeCodes: ["en"],
      siteKey: "superfunky-pro",
      artifactOrigin: "https://v3.superfunky.pro",
      shellVersion: "deploy-123",
    });
    assert.deepEqual(manifest.seedRoutes, [
      { route: "/", locale: "en" },
      { route: "/product/example", locale: "en" },
      { route: "/shop", locale: "en" },
    ]);
  });
  assert.deepEqual(manifest.seedRoutes, [
    { route: "/", locale: "en" },
    { route: "/shop", locale: "en" },
  ]);
  assert.equal(manifest.assets.length, 2);
  for (const slot of ["head", "css", "content", "payload"]) {
    assert.equal(manifest.template.split(`<!--storefront-artifact-${slot}-->`).length, 2);
  }
  assert.match(manifest.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test("artifact configuration is fail-closed when enabled", () => {
  assert.deepEqual(artifactConfigFromEnvironment({}), { mode: "off" });
  assert.throws(
    () => artifactConfigFromEnvironment({ STOREFRONT_ARTIFACT_MODE: "artifact" }),
    /STOREFRONT_ARTIFACT_ORIGIN/,
  );
});

test("artifact configuration normalizes deployment secret whitespace like WordPress", () => {
  const signingSecret = "a".repeat(32);
  const config = artifactConfigFromEnvironment({
    STOREFRONT_ARTIFACT_MODE: "shadow",
    STOREFRONT_ARTIFACT_ORIGIN: "https://v3.superfunky.pro",
    STOREFRONT_ARTIFACT_SITE_KEY: "flagship",
    STOREFRONT_ARTIFACT_SIGNING_SECRET: `  ${signingSecret}\n`,
  });
  assert.equal(config.signingSecret, signingSecret);
});

test("shell publication signs the exact request body", async () => {
  const manifest = createShellManifest({
    html,
    routes: [{ path: "/", lang: "en" }],
    localeCodes: ["en"],
    siteKey: "superfunky-pro",
    artifactOrigin: "https://v3.superfunky.pro",
    shellVersion: "deploy-123",
  });
  let request;
  const result = await publishShellManifest({
    manifest,
    artifactOrigin: "https://v3.superfunky.pro",
    signingSecret: "a".repeat(32),
    now: 1_700_000_000_000,
    eventId: "shell-test",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response('{"seededRoutes":1}', { status: 201, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(result.seededRoutes, 1);
  assert.equal(request.url, "https://v3.superfunky.pro/wp-json/funkycommerce-artifacts/v1/shell");
  assert.equal(request.options.body, JSON.stringify(manifest));
  assert.match(request.options.headers["x-superfunky-signature"], /^[a-f0-9]{64}$/);
});

test("artifact redirects are route-specific and forced after successful registration", () => {
  const redirects = artifactProxyRedirects({
    shellVersion: "deploy-123",
    seedRoutes: [{ route: "/shop", locale: "en" }],
  }, "https://v3.superfunky.pro");
  assert.deepEqual(redirects, [
    "/shop  https://v3.superfunky.pro/wp-json/funkycommerce-artifacts/v1/artifact?route=%2Fshop&locale=en&shell=deploy-123  200!",
  ]);
});

test("shadow publication preserves static delivery while artifact mode remains fail-closed", async () => {
  const manifest = createShellManifest({
    html,
    routes: [{ path: "/", lang: "en" }],
    localeCodes: ["en"],
    siteKey: "superfunky-pro",
    artifactOrigin: "https://v3.superfunky.pro",
    shellVersion: "deploy-123",
  });
  const rejectedFetch = async () => new Response(
    '{"code":"artifact_invalid_signature"}',
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
  const shadowResult = await publishShellManifestForMode({
    mode: "shadow",
    manifest,
    artifactOrigin: "https://v3.superfunky.pro",
    signingSecret: "a".repeat(32),
    fetchImpl: rejectedFetch,
  });
  assert.equal(shadowResult.published, false);
  assert.equal(shadowResult.registration, null);
  assert.match(shadowResult.error, /HTTP 401/);

  await assert.rejects(
    publishShellManifestForMode({
      mode: "artifact",
      manifest,
      artifactOrigin: "https://v3.superfunky.pro",
      signingSecret: "a".repeat(32),
      fetchImpl: rejectedFetch,
    }),
    /HTTP 401/,
  );
});
