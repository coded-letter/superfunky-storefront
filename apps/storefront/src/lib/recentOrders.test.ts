import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { startRecentOrdersNotifier } from "./recentOrders.ts";

const recentOrdersBackend = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/recent-orders.php", import.meta.url),
  "utf8",
);
const controlCenterSchema = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/control-center-schema.php", import.meta.url),
  "utf8",
);
const controlCenterRuntime = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/control-center.php", import.meta.url),
  "utf8",
);
const storefrontStyles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");

const orders = [
  {
    id: "order-a",
    customerFirstName: "George",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    items: [{ name: "Premium theme", quantity: 1, url: "/product/premium-theme/" }],
  },
  {
    id: "order-b",
    customerFirstName: "Anna",
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    items: [{ name: "Gallery plugin", quantity: 2, url: "https://cms.example/product/gallery-plugin/" }],
  },
];

test("recent orders expose public product links and only reserve chatbot space when needed", () => {
  assert.match(recentOrdersBackend, /'publish' === \$product->get_status\(\)/);
  assert.match(recentOrdersBackend, /wp_make_link_relative\( \$product->get_permalink\(\) \)/);
  assert.match(recentOrdersBackend, /! funkycommerce_is_pro\(\) \|\| empty\( \$config\['enabled'\] \)/);
  assert.match(controlCenterSchema, /recent_orders_enabled[\s\S]*'tier'\s*=>\s*'pro'/);
  assert.match(controlCenterRuntime, /'enabled'\s*=>\s*funkycommerce_is_pro\(\) && 'yes' === \( \$settings\['recent_orders_enabled'\]/);
  assert.match(storefrontStyles, /\.storefront-recent-orders \{[\s\S]*bottom: max\(1rem,/);
  assert.match(storefrontStyles, /\[data-chatbot-offset="true"\] \{[\s\S]*bottom: max\(5\.5rem,/);
  assert.match(storefrontStyles, /\.storefront-recent-orders__product/);
  assert.match(prerenderSource, /STATIC_RECENT_ORDERS_LEGACY_QUERY/);
  assert.match(prerenderSource, /legacy storefront recent-order controls/);
  for (const setting of [
    "recent_orders_enabled",
    "recent_orders_item_count",
    "recent_orders_interval_seconds",
    "recent_orders_quiet_seconds",
  ]) {
    assert.match(
      controlCenterSchema,
      new RegExp(`'${setting}'[\\s\\S]{0,700}'tier'\\s*=>\\s*'pro'`),
    );
  }
});

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

  localStorage.setItem("storefront:recent-orders:v2", JSON.stringify({
    orderId: "order-b",
    nextAt: Date.now() + 20_000,
    cycleMs: 18_000,
  }));
  const stop = await startRecentOrdersNotifier({
    enabled: true,
    endpoint: "https://api.example/wp-json/funkycommerce/v1/recent-orders",
    intervalSeconds: 10,
    quietSeconds: 8,
    itemCount: 2,
  });

  const notifier = document.getElementById("storefront-recent-orders");
  assert.ok(notifier);
  assert.match(notifier.textContent || "", /Anna bought 2 × Gallery plugin/);
  assert.equal(notifier.dataset.chatbotOffset, "false");
  const productLink = notifier.querySelector<HTMLAnchorElement>(".storefront-recent-orders__product");
  assert.equal(productLink?.getAttribute("href"), "/product/gallery-plugin/");
  const chatbotRoot = document.createElement("div");
  chatbotRoot.id = "funkycommerce-ai-assistant-root";
  document.body.append(chatbotRoot);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(notifier.dataset.chatbotOffset, "true");
  const persisted = JSON.parse(localStorage.getItem("storefront:recent-orders:v2") || "{}");
  assert.equal(persisted.orderId, "order-b");
  assert.equal(persisted.cycleMs, 18_000);

  stop();
  const cadenceChangedStop = await startRecentOrdersNotifier({
    enabled: true,
    endpoint: "https://api.example/wp-json/funkycommerce/v1/recent-orders",
    intervalSeconds: 3,
    quietSeconds: 2,
    itemCount: 2,
  });
  assert.match(notifier.parentElement?.textContent || document.body.textContent || "", /George bought Premium theme/);
  const changedCadenceState = JSON.parse(localStorage.getItem("storefront:recent-orders:v2") || "{}");
  assert.equal(changedCadenceState.cycleMs, 5_000);
  cadenceChangedStop();
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
    quietSeconds: 8,
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

test("recent orders hide during the quiet phase and resume the persisted cycle", async () => {
  const dom = new JSDOM("<!doctype html><html lang=\"en\"><body></body></html>", {
    url: "https://store.example/",
  });
  const timers: Array<{ callback: () => void; delay: number; active: boolean }> = [];
  let now = 1_000_000;
  const realDateNow = Date.now;
  Date.now = () => now;
  dom.window.setTimeout = ((callback: TimerHandler, delay = 0) => {
    const timer = {
      callback: typeof callback === "function" ? callback as () => void : () => undefined,
      delay,
      active: true,
    };
    timers.push(timer);
    return timers.length;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = ((id: number) => {
    const timer = timers[id - 1];
    if (timer) timer.active = false;
  }) as typeof dom.window.clearTimeout;
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    fetch: async () => new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  });
  const config = {
    enabled: true,
    endpoint: "https://api.example/wp-json/funkycommerce/v1/recent-orders",
    intervalSeconds: 3,
    quietSeconds: 2,
    itemCount: 2,
  };

  const stop = await startRecentOrdersNotifier(config);
  const notifier = document.getElementById("storefront-recent-orders");
  assert.equal(notifier?.dataset.visible, "true");
  assert.match(notifier?.textContent || "", /Premium theme/);

  const hideTimer = timers.find((timer) => timer.active && timer.delay === 3_000);
  assert.ok(hideTimer);
  now += 3_000;
  hideTimer.active = false;
  hideTimer.callback();
  assert.equal(notifier?.dataset.visible, "false");

  const staleTransitionTimer = timers.find((timer) => timer.active && timer.delay === 180);
  const firstCycleTimer = timers.find((timer) => timer.active && timer.delay === 5_000);
  assert.ok(staleTransitionTimer);
  assert.ok(firstCycleTimer);
  now += 2_000;
  firstCycleTimer.active = false;
  firstCycleTimer.callback();
  assert.equal(staleTransitionTimer.active, false);
  assert.equal(notifier?.dataset.visible, "true");
  assert.match(notifier?.textContent || "", /Gallery plugin/);

  const secondHideTimer = timers.find((timer) => timer.active && timer.delay === 3_000);
  assert.ok(secondHideTimer);
  now += 3_000;
  secondHideTimer.active = false;
  secondHideTimer.callback();
  assert.equal(notifier?.dataset.visible, "false");

  now += 500;
  stop();
  const resumedStop = await startRecentOrdersNotifier(config);
  const resumedNotifier = document.getElementById("storefront-recent-orders");
  assert.equal(resumedNotifier?.dataset.visible, "false");
  const resumedTimer = timers.find((timer) => timer.active && timer.delay === 1_500);
  assert.ok(resumedTimer);
  now += 1_500;
  resumedTimer.active = false;
  resumedTimer.callback();
  assert.equal(resumedNotifier?.dataset.visible, "true");
  assert.match(resumedNotifier?.textContent || "", /Premium theme/);

  resumedStop();
  Date.now = realDateNow;
  dom.window.close();
});
