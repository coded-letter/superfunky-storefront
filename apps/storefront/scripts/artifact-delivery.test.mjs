import assert from "node:assert/strict";
import test from "node:test";

import { deliverArtifact } from "../../../netlify/functions/artifact-delivery.mjs";

const request = new Request(
  "https://storefront.test/.netlify/functions/artifact-delivery?route=%2Fshop&locale=en&shell=shell-1",
);
const environment = { STOREFRONT_ARTIFACT_ORIGIN: "https://backend.test" };

test("serves a ready HTML artifact", async () => {
  const response = await deliverArtifact(request, environment, async () => new Response("<html>artifact</html>", {
    headers: {
      "Content-Type": "text/html",
      "X-Superfunky-Artifact-State": "ready",
    },
  }));
  assert.equal(await response.text(), "<html>artifact</html>");
  assert.equal(response.headers.get("x-superfunky-artifact-state"), "ready");
});

test("falls back to the deployed static document after an artifact miss", async () => {
  const urls = [];
  const response = await deliverArtifact(request, environment, async (url) => {
    urls.push(String(url));
    if (urls.length === 1) return new Response('{"code":"artifact_not_found"}', { status: 404 });
    return new Response("<html>static</html>", { headers: { "Content-Type": "text/html" } });
  });
  assert.equal(await response.text(), "<html>static</html>");
  assert.equal(response.headers.get("x-superfunky-artifact-state"), "static-fallback");
  assert.equal(urls[1], "https://storefront.test/.storefront-static/shop/index.html");
});

test("falls back after an artifact request throws", async () => {
  let calls = 0;
  const response = await deliverArtifact(request, environment, async () => {
    calls += 1;
    if (calls === 1) throw new Error("backend unavailable");
    return new Response("<html>static</html>", { headers: { "Content-Type": "text/html" } });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-superfunky-artifact-state"), "static-fallback");
});

test("rejects unsafe fallback paths", async () => {
  const unsafe = new Request(
    "https://storefront.test/.netlify/functions/artifact-delivery?route=%2F..%2Fsecret&locale=en&shell=shell-1",
  );
  const response = await deliverArtifact(unsafe, environment, async () => {
    throw new Error("must not fetch");
  });
  assert.equal(response.status, 400);
});
