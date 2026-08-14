import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyStorefrontRequest,
  createArtifactIdentityKey,
  isDependencyTag,
  normalizePublicRoutePath,
  validateArtifactChangeEvent,
  validateContentRevision,
  validateRouteArtifact,
  validateStorefrontShellManifest,
} from "./index.ts";

const fixtureUrl = new URL("../fixtures/protocol-v1.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("accepts the shared protocol v1 compatibility fixture", () => {
  assert.equal(validateStorefrontShellManifest(fixture.shell).ok, true);
  assert.equal(validateRouteArtifact(fixture.artifact).ok, true);
  assert.equal(validateContentRevision(fixture.revision).ok, true);
  assert.equal(validateArtifactChangeEvent(fixture.changeEvent).ok, true);
});

test("rejects unknown future wire schema versions", () => {
  const futureShell = { ...fixture.shell, schemaVersion: 2 };
  const result = validateStorefrontShellManifest(futureShell);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.issues[0], {
      path: "schemaVersion",
      message: "Expected schema version 1.",
    });
  }
});

test("enforces artifact identity, revision, and failure invariants", () => {
  const invalid = {
    ...fixture.artifact,
    state: "failed",
    failure: null,
    sourceRevision: 43,
    identity: {
      ...fixture.artifact.identity,
      route: "/shop/",
    },
  };
  const result = validateRouteArtifact(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      new Set(result.issues.map(({ path }) => path)),
      new Set(["identity.route", "failure", "hydration.contentRevision"]),
    );
  }
});

test("normalizes canonical paths without accepting ambiguous input", () => {
  assert.equal(normalizePublicRoutePath("/shop/"), "/shop");
  assert.equal(normalizePublicRoutePath("/pro-tag/caf%C3%A9/"), "/pro-tag/caf%C3%A9");
  assert.equal(normalizePublicRoutePath("/pro-tag/a%2Fb/"), "/pro-tag/a%2Fb");
  assert.equal(normalizePublicRoutePath("/shop?preview=true"), null);
  assert.equal(normalizePublicRoutePath("//attacker.test/shop"), null);
  assert.equal(normalizePublicRoutePath("/a/../account"), null);
  assert.equal(normalizePublicRoutePath("/shop\\checkout"), null);
});

test("classifies public documents, private routes, and non-document bypasses", () => {
  assert.deepEqual(classifyStorefrontRequest({ target: "/shop/", localeCodes: ["en", "pl"] }), {
    kind: "public-artifact",
    reason: "public-document",
    normalizedPath: "/shop",
  });
  assert.deepEqual(classifyStorefrontRequest({ target: "/checkout", localeCodes: ["en", "pl"] }), {
    kind: "private-document",
    reason: "private-route",
    normalizedPath: "/checkout",
  });
  assert.deepEqual(classifyStorefrontRequest({ target: "/en/account/orders", localeCodes: ["en", "pl"] }), {
    kind: "private-document",
    reason: "private-route",
    normalizedPath: "/en/account/orders",
  });
  assert.equal(
    classifyStorefrontRequest({ target: "/pl/order/123", localeCodes: ["en", "pl"] }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/oauth/login/google", localeCodes: [] }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/layout-studio", localeCodes: [] }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/toy/wishlist", localeCodes: ["en", "pl"] }).kind,
    "public-artifact",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/EN/account", localeCodes: ["en", "pl"] }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/Checkout", localeCodes: [] }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({
      target: "/custom-account",
      localeCodes: [],
      visibility: "private",
    }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/shop", localeCodes: [], authenticated: true }).kind,
    "private-document",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/assets/app.js", localeCodes: [] }).kind,
    "bypass",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/shop?currency=EUR", localeCodes: [] }).reason,
    "query",
  );
  assert.equal(
    classifyStorefrontRequest({ target: "/shop", localeCodes: [], method: "POST" }).reason,
    "method",
  );
});

test("serializes every artifact identity dimension deterministically", () => {
  assert.equal(
    createArtifactIdentityKey(fixture.artifact.identity),
    "superfunky-pro|en|shell-2026.08.13|public|%2Fshop",
  );
});

test("accepts typed dependency tags and rejects ambiguous tags", () => {
  for (const dependency of [
    "post:123",
    "term:product-category:7",
    "menu:header",
    "theme:global",
    "route:/shop",
  ]) {
    assert.equal(isDependencyTag(dependency), true, dependency);
  }
  for (const dependency of ["post:", "unknown:1", "route:/shop/", "term:category", "menu:header nav"]) {
    assert.equal(isDependencyTag(dependency), false, dependency);
  }
});
