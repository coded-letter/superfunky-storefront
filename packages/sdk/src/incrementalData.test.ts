import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  seedIncrementalData,
  seedStorefrontHydration,
  useIncrementalData,
} from "./incrementalData.ts";

test("a prerendered hydration seed is immediately revalidated with fresh content", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://storefront.test/" });
  Object.assign(globalThis, {
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const key = `hydration-test:${Date.now()}`;
  let resolveFresh!: (value: string) => void;
  let fetchCount = 0;
  const freshResponse = new Promise<string>((resolve) => {
    resolveFresh = resolve;
  });

  seedIncrementalData(key, "prerendered-old");

  function Probe() {
    const { data } = useIncrementalData(key, () => {
      fetchCount += 1;
      return freshResponse;
    });
    return React.createElement("span", null, data);
  }

  const root = createRoot(document.querySelector("#root")!);
  await React.act(async () => {
    root.render(React.createElement(Probe));
  });

  assert.equal(document.querySelector("span")?.textContent, "prerendered-old");
  assert.equal(fetchCount, 1);

  await React.act(async () => {
    resolveFresh("network-fresh");
    await freshResponse;
  });

  assert.equal(document.querySelector("span")?.textContent, "network-fresh");
  await React.act(async () => root.unmount());
  dom.window.close();
});

test("a current trusted artifact seed avoids duplicate first-render data requests", async () => {
  const dom = new JSDOM(
    '<head><meta name="storefront-artifact-revision-endpoint" content="https://cms.test/wp-json/funkycommerce-artifacts/v1/revision"></head><body><div id="root"></div></body>',
    { url: "https://storefront.test/" },
  );
  Object.assign(globalThis, {
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => new Response(JSON.stringify({
      schemaVersion: 1,
      siteKey: "storefront-test",
      revision: 7,
      changedAt: new Date().toISOString(),
      dependencies: [],
      etag: '"revision-7"',
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const key = `artifact-route:v1:/test-${Date.now()}`;
  let fetchCount = 0;

  assert.ok(seedStorefrontHydration({
    schemaVersion: 1,
    shellVersion: "shell-test",
    contentRevision: 7,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    entries: [{
      cacheKey: key,
      value: "artifact-current",
      dependencies: ["route:/"],
    }],
  }));

  function Probe() {
    const { data } = useIncrementalData(key, async () => {
      fetchCount += 1;
      return "network";
    });
    return React.createElement("span", null, data);
  }

  const root = createRoot(document.querySelector("#root")!);
  await React.act(async () => {
    root.render(React.createElement(Probe));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(document.querySelector("span")?.textContent, "artifact-current");
  assert.equal(fetchCount, 0);
  await React.act(async () => root.unmount());
  dom.window.close();
});

test("disabled incremental data waits to fetch until route-critical content is ready", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://storefront.test/" });
  Object.assign(globalThis, {
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const key = `deferred-test:${Date.now()}`;
  let fetchCount = 0;

  function Probe({ enabled }: { enabled: boolean }) {
    const { data, isLoading } = useIncrementalData(
      key,
      async () => {
        fetchCount += 1;
        return "loaded";
      },
      enabled,
    );
    return React.createElement("span", null, `${isLoading}:${data || ""}`);
  }

  const root = createRoot(document.querySelector("#root")!);
  await React.act(async () => {
    root.render(React.createElement(Probe, { enabled: false }));
  });
  assert.equal(fetchCount, 0);
  assert.equal(document.querySelector("span")?.textContent, "false:");

  await React.act(async () => {
    root.render(React.createElement(Probe, { enabled: true }));
  });
  assert.equal(fetchCount, 1);
  assert.equal(document.querySelector("span")?.textContent, "false:loaded");

  await React.act(async () => root.unmount());
  dom.window.close();
});
