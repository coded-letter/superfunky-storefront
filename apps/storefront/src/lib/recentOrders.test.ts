import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { startRecentOrdersNotifier } from "./recentOrders.ts";

const orders = [
  {
    id: "order-a",
    customerFirstName: "George",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    items: [{ name: "Premium theme", quantity: 1 }],
  },
  {
    id: "order-b",
    customerFirstName: "Anna",
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    items: [{ name: "Gallery plugin", quantity: 2 }],
  },
];

test("recent orders preserve the visible order and interval across reload-style restarts", async () => {
  const dom = new JSDOM("<!doctype html><html lang=\"en\"><body></body></html>", {
    url: "https://store.example/",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    fetch: async () => new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  });

  localStorage.setItem("storefront:recent-orders:v1", JSON.stringify({
    orderId: "order-b",
    nextAt: Date.now() + 20_000,
  }));
  const stop = await startRecentOrdersNotifier({
    enabled: true,
    endpoint: "https://api.example/wp-json/funkycommerce/v1/recent-orders",
    intervalSeconds: 10,
    itemCount: 2,
  });

  const notifier = document.getElementById("storefront-recent-orders");
  assert.ok(notifier);
  assert.match(notifier.textContent || "", /Anna bought 2 × Gallery plugin/);
  const persisted = JSON.parse(localStorage.getItem("storefront:recent-orders:v1") || "{}");
  assert.equal(persisted.orderId, "order-b");

  stop();
  dom.window.close();
});

test("recent-order startup failures clean up and allow the same configuration to retry", async () => {
  const dom = new JSDOM("<!doctype html><html lang=\"en\"><body></body></html>", {
    url: "https://store.example/",
  });
  let shouldFail = true;
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    DOMException: dom.window.DOMException,
    fetch: async () => {
      if (shouldFail) throw new Error("temporary network failure");
      return new Response(JSON.stringify({ orders }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const config = {
    enabled: true,
    endpoint: "https://api.example/wp-json/funkycommerce/v1/recent-orders",
    intervalSeconds: 10,
    itemCount: 2,
  };

  await assert.rejects(startRecentOrdersNotifier(config), /temporary network failure/);
  assert.equal(document.getElementById("storefront-recent-orders"), null);
  shouldFail = false;
  const stop = await startRecentOrdersNotifier(config);
  assert.ok(document.getElementById("storefront-recent-orders"));

  stop();
  dom.window.close();
});
