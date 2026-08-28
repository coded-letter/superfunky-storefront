import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import {
  NATIVE_LINK_ATTRIBUTE,
  classifyAnchor,
  mountHashAnchorScroll,
  mountSmartLinkNavigation,
  shouldAvoidPrefetch,
} from "./internalLinks.ts";
import { normalizeLanguagePath } from "../../../../packages/ui/src/locale/urlPaths.ts";

let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM("<main id=\"root\"></main>", {
    url: "https://store.test/en/documentation/guide/?view=full",
    pretendToBeVisual: true,
  });
});

afterEach(() => dom.window.close());

function classify(href: string, attributes: Record<string, string> = {}) {
  const anchor = dom.window.document.createElement("a");
  anchor.setAttribute("href", href);
  Object.entries(attributes).forEach(([name, value]) => anchor.setAttribute(name, value));
  return classifyAnchor(anchor, {
    currentUrl: dom.window.location.href,
    storefrontOrigin: dom.window.location.origin,
    backendOrigin: "https://v3.superfunky.pro",
  });
}

test("classifies relative, same-origin, language, query, and backend content URLs", () => {
  assert.deepEqual(classify("../next/?page=2#details"), {
    kind: "internal",
    url: new URL("https://store.test/en/documentation/next/?page=2#details"),
    to: "/en/documentation/next/?page=2#details",
    mappedFromBackend: false,
  });
  assert.equal(classify("https://store.test/pl/sklep/?sort=new").kind, "internal");
  const rootAnchor = classify("/#faq");
  assert.equal(rootAnchor.kind, "internal");
  if (rootAnchor.kind === "internal") {
    assert.equal(rootAnchor.to, "/#faq");
  }
  const samePageAnchor = classify("/en/documentation/guide/?view=full#section");
  assert.equal(samePageAnchor.kind, "internal");
  if (samePageAnchor.kind === "internal") {
    assert.equal(samePageAnchor.to, "/en/documentation/guide/?view=full#section");
  }

  const backend = classify("https://v3.superfunky.pro/documentation/setup/?step=2#start");
  assert.equal(backend.kind, "internal");
  if (backend.kind === "internal") {
    assert.equal(backend.to, "/documentation/setup/?step=2#start");
    assert.equal(backend.mappedFromBackend, true);
  }

  const taxonomy = classify("https://v3.superfunky.pro/pro-category/plugins/");
  assert.equal(taxonomy.kind, "internal");
  if (taxonomy.kind === "internal") {
    assert.equal(taxonomy.to, "/pro-category/plugins/");
    assert.equal(taxonomy.mappedFromBackend, true);
  }
});

test("keeps routed hash scrolling active through prerender replacement", async () => {
  const target = dom.window.document.createElement("section");
  target.id = "faq";
  let scrollCalls = 0;
  target.scrollIntoView = () => {
    scrollCalls += 1;
  };
  dom.window.document.body.append(target);

  const cleanup = mountHashAnchorScroll({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    hash: "#faq",
    timeoutMs: 50,
  });
  assert.equal(scrollCalls, 1);

  dom.window.document.body.append(dom.window.document.createElement("div"));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(scrollCalls, 1);

  const replacement = target.cloneNode() as HTMLElement;
  replacement.scrollIntoView = () => {
    scrollCalls += 1;
  };
  target.replaceWith(replacement);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.ok(scrollCalls >= 2);
  cleanup();
});

test("leaves external, backend application, special-scheme, and native anchors alone", () => {
  const cases: Array<[string, Record<string, string>?]> = [
    ["https://example.test/page"],
    ["https://cdn.store.test/page"],
    ["https://v3.superfunky.pro/wp-admin/edit.php"],
    ["https://v3.superfunky.pro/wp-json/wp/v2/pages"],
    ["https://v3.superfunky.pro/?download_file=4970&order=wc_order_test&key=file-id"],
    ["mailto:hello@example.test"],
    ["tel:+123456"],
    ["javascript:void(0)"],
    ["data:text/plain,hello"],
    ["blob:https://store.test/id"],
    ["#section"],
    ["/download", { download: "" }],
    ["/new-tab", { target: "_blank" }],
    ["/external-contract", { rel: "nofollow external" }],
    ["/native", { [NATIVE_LINK_ATTRIBUTE]: "" }],
  ];
  cases.forEach(([href, attributes]) => assert.equal(classify(href, attributes).kind, "native", href));
  assert.equal(classify("/en/documentation/guide/?view=compact").kind, "internal");
});

test("delegates dynamic CMS anchors while preserving modified clicks and editable content", () => {
  const navigations: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    backendOrigin: "https://v3.superfunky.pro",
    navigate: (to) => navigations.push(to),
    prefetch: () => undefined,
  });

  const root = dom.window.document.querySelector("#root")!;
  root.insertAdjacentHTML("beforeend", `
    <a id="dynamic" href="/documentation/dynamic/?q=1#intro">Dynamic</a>
    <div contenteditable="true"><a id="editable" href="/editable">Editable</a></div>
  `);

  const dynamic = dom.window.document.querySelector("#dynamic")!;
  dynamic.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  dynamic.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true }));
  dom.window.document.querySelector("#editable")!
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  assert.deepEqual(navigations, ["/documentation/dynamic/?q=1#intro"]);

  cleanup();
  dynamic.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  assert.deepEqual(navigations, ["/documentation/dynamic/?q=1#intro"]);
});

test("delegates same-page path anchors so locked mobile layouts can release before scrolling", () => {
  const navigations: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    backendOrigin: "https://v3.superfunky.pro",
    navigate: (to) => navigations.push(to),
    prefetch: () => undefined,
  });
  const root = dom.window.document.querySelector("#root")!;
  root.innerHTML = '<a id="same-page" href="/en/documentation/guide/?view=full#faq">FAQ</a>';
  const click = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  root.querySelector("#same-page")!.dispatchEvent(click);

  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(navigations, ["/en/documentation/guide/?view=full#faq"]);
  cleanup();
});

test("leaves the authoritative prerender shell links native until handoff", () => {
  const navigations: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    navigate: (to) => navigations.push(to),
    prefetch: () => undefined,
  });
  const root = dom.window.document.querySelector("#root")!;
  root.className = "storefront-prerender-stage";
  root.innerHTML = '<a id="static-link" href="/pl/about/">About</a>';
  const link = root.querySelector<HTMLAnchorElement>("#static-link")!;
  link.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true }));
  const nativeClick = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(nativeClick);

  assert.equal(link.getAttribute("href"), "/pl/about/");
  assert.equal(nativeClick.defaultPrevented, false);
  assert.deepEqual(navigations, []);

  root.classList.add("is-replaced");
  const reactClick = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(reactClick);
  assert.equal(reactClick.defaultPrevented, true);
  assert.deepEqual(navigations, ["/pl/about/"]);
  cleanup();
});

test("never rewrites or intercepts native WooCommerce download anchors", () => {
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    backendOrigin: "https://v3.superfunky.pro",
    navigate: () => assert.fail("Native download links must not use SPA navigation."),
    prefetch: () => undefined,
  });
  const href = "https://v3.superfunky.pro/?download_file=4970&order=wc_order_test&key=file-id";
  dom.window.document.querySelector("#root")!.innerHTML = `
    <a id="download" href="${href}" ${NATIVE_LINK_ATTRIBUTE}>Download</a>
  `;
  const anchor = dom.window.document.querySelector<HTMLAnchorElement>("#download")!;

  assert.equal(anchor.href, href);
  assert.equal(classifyAnchor(anchor, {
    currentUrl: dom.window.location.href,
    storefrontOrigin: dom.window.location.origin,
    backendOrigin: "https://v3.superfunky.pro",
  }).kind, "native");
  cleanup();
});

test("smart navigation canonicalizes links using authoritative language cardinality", () => {
  const navigations: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    normalizeTo: (to) => normalizeLanguagePath(to, "en", ["en"]),
    navigate: (to) => navigations.push(to),
    prefetch: () => undefined,
  });
  dom.window.document.querySelector("#root")!.innerHTML = `
    <a id="old-cart" href="/en/cart/">Cart</a>
    <a id="legitimate" href="/de/about/">About</a>
  `;
  dom.window.document.querySelector("#old-cart")!
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  dom.window.document.querySelector("#legitimate")!
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  assert.deepEqual(navigations, ["/cart/", "/de/about/"]);
  cleanup();
});

test("smart navigation never localizes language-independent admin tools", () => {
  const navigations: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    normalizeTo: (to) => normalizeLanguagePath(to, "pl", ["en", "pl"]),
    navigate: (to) => navigations.push(to),
    prefetch: () => undefined,
  });
  dom.window.document.querySelector("#root")!.innerHTML = `
    <a id="shortcodes" href="/shortcodes">Shortcodes</a>
    <a id="studio" href="/en/layout-studio">Layout studio</a>
  `;
  dom.window.document.querySelector("#shortcodes")!
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  dom.window.document.querySelector("#studio")!
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  assert.deepEqual(navigations, ["/shortcodes", "/layout-studio"]);
  cleanup();
});

test("prefetches once across hover and focus, cancels abandoned intent, and cleans up", async () => {
  const prefetched: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    navigate: () => undefined,
    prefetch: (to) => prefetched.push(to),
    intentDelay: 5,
  });
  const root = dom.window.document.querySelector("#root")!;
  root.innerHTML = '<a id="intent" href="/intent"><span>Intent</span></a><a id="cancel" href="/cancel">Cancel</a>';
  const child = root.querySelector("#intent span")!;
  child.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true }));
  root.querySelector("#intent")!.dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  assert.deepEqual(prefetched, ["/intent"]);

  const cancel = root.querySelector("#cancel")!;
  cancel.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true }));
  cancel.dispatchEvent(new dom.window.MouseEvent("pointerout", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  assert.deepEqual(prefetched, ["/intent"]);

  cleanup();
  cancel.dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  assert.deepEqual(prefetched, ["/intent"]);
});

test("prefetches same-site new-tab links without intercepting their navigation", async () => {
  const navigations: string[] = [];
  const prefetched: string[] = [];
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    navigate: (to) => navigations.push(to),
    prefetch: (to) => prefetched.push(to),
    intentDelay: 0,
  });
  const root = dom.window.document.querySelector("#root")!;
  root.innerHTML = '<a id="new-tab" href="/new-tab" target="_blank">New tab</a>';
  const link = root.querySelector("#new-tab")!;

  link.dispatchEvent(new dom.window.MouseEvent("pointerover", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  const click = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(click);

  assert.deepEqual(prefetched, ["/new-tab"]);
  assert.deepEqual(navigations, []);
  assert.equal(click.defaultPrevented, false);
  cleanup();
});

test("respects Save-Data and slow network hints", async () => {
  const navigator = dom.window.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: { saveData: true, effectiveType: "4g" },
  });
  assert.equal(shouldAvoidPrefetch(navigator), true);
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: { saveData: false, effectiveType: "slow-2g" },
  });
  assert.equal(shouldAvoidPrefetch(navigator), true);

  let calls = 0;
  const cleanup = mountSmartLinkNavigation({
    document: dom.window.document,
    window: dom.window as unknown as Window,
    navigate: () => undefined,
    prefetch: () => { calls += 1; },
    intentDelay: 0,
  });
  dom.window.document.querySelector("#root")!.innerHTML = '<a id="slow" href="/slow">Slow</a>';
  dom.window.document.querySelector("#slow")!
    .dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  assert.equal(calls, 0);
  cleanup();
});
