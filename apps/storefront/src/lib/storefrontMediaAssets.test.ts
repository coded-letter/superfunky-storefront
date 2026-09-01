import assert from "node:assert/strict";
import test from "node:test";

import {
  isStorefrontProxiedMediaPath,
  storefrontProxiedMediaUrl,
} from "./storefrontMediaAssets.ts";

const environment = {
  backendOrigin: "https://panel.aqua-bar.pl",
  baseUrl: "https://aqua-bar.example/",
};

test("rewrites backend PDF and GLB assets to the storefront uploads proxy", () => {
  assert.equal(
    storefrontProxiedMediaUrl(
      "https://panel.aqua-bar.pl/wp-content/uploads/2026/09/vending_machine.glb?revision=2#model",
      environment,
    ),
    "/wp-content/uploads/2026/09/vending_machine.glb?revision=2#model",
  );
  assert.equal(
    storefrontProxiedMediaUrl(
      "https://panel.aqua-bar.pl/wp-content/uploads/2026/09/catalog.PDF",
      environment,
    ),
    "/wp-content/uploads/2026/09/catalog.PDF",
  );
});

test("keeps external, non-upload, and unsupported media URLs unchanged", () => {
  assert.equal(
    storefrontProxiedMediaUrl("https://cdn.example.test/vending_machine.glb", environment),
    null,
  );
  assert.equal(
    storefrontProxiedMediaUrl("https://panel.aqua-bar.pl/private/vending_machine.glb", environment),
    null,
  );
  assert.equal(
    storefrontProxiedMediaUrl(
      "https://panel.aqua-bar.pl/wp-content/uploads/2026/09/vending_machine.gltf",
      environment,
    ),
    null,
  );
  assert.equal(isStorefrontProxiedMediaPath("/wp-content/uploads/2026/09/model.glb"), true);
  assert.equal(isStorefrontProxiedMediaPath("/wp-content/uploads/2026/09/model.js"), false);
});
