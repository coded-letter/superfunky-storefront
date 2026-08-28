import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { mountCmsScripts, mountEnqueuedScripts } from "./pageScripts.ts";

const serviceWorkerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM('<main id="root"></main>', {
    runScripts: "dangerously",
    url: "https://storefront.example.test/",
  });

  dom.window.document.querySelector("#root")!.innerHTML = `
      <style data-wp-block-html="css">.editor-styled { color: rgb(12, 34, 56); }</style>
      <div class="editor-styled">Styled by WordPress</div>
      <script data-wp-block-html="js">
        if (true &#038;&#038; true) {
          window.cmsExecutionCount = (window.cmsExecutionCount || 0) + 1;
        }
      </script>
      <script data-wp-block-html="js" src="https://cdn.example.test/integration.js"
        async defer crossorigin="anonymous" data-integration="example"></script>
  `;

  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    MutationObserver: dom.window.MutationObserver,
    HTMLElement: dom.window.HTMLElement,
    HTMLScriptElement: dom.window.HTMLScriptElement,
  });
});

afterEach(() => dom.window.close());

test("mountCmsScripts executes editor code, preserves attributes, and does not remount scripts", async () => {
  const root = document.querySelector<HTMLElement>("#root")!;
  const runtimeWindow = window as typeof window & { cmsExecutionCount?: number };

  assert.equal(runtimeWindow.cmsExecutionCount, undefined);
  const cleanup = mountCmsScripts(root);

  assert.equal(runtimeWindow.cmsExecutionCount, 1);
  assert.equal(document.styleSheets[0]?.cssRules[0]?.cssText.includes(".editor-styled"), true);
  const external = root.querySelector<HTMLScriptElement>('script[src*="integration.js"]')!;
  assert.equal(external.hasAttribute("async"), true);
  assert.equal(external.hasAttribute("defer"), true);
  assert.equal(external.getAttribute("crossorigin"), "anonymous");
  assert.equal(external.dataset.integration, "example");
  assert.equal(external.dataset.funkyCmsExecuted, "true");

  cleanup();
  const remountCleanup = mountCmsScripts(root);
  assert.equal(runtimeWindow.cmsExecutionCount, 1);

  const dynamic = document.createElement("div");
  dynamic.innerHTML = `
    <script data-wp-block-html="js">
      window.cmsExecutionCount = (window.cmsExecutionCount || 0) + 1;
    </script>
  `;
  root.append(dynamic);
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.equal(runtimeWindow.cmsExecutionCount, 2);
  assert.equal(dynamic.querySelector("script")?.getAttribute("data-funky-cms-executed"), "true");
  remountCleanup();
});

test("mountCmsScripts rejects HTML responses embedded as inline JavaScript", () => {
  const root = document.querySelector<HTMLElement>("#root")!;
  root.innerHTML = `
    <script data-wp-block-html="js">
      &lt;!doctype html&gt;&lt;html&gt;&lt;body&gt;Authentication required&lt;/body&gt;&lt;/html&gt;
    </script>
  `;
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);

  try {
    const cleanup = mountCmsScripts(root);
    const rejected = root.querySelector<HTMLScriptElement>("script")!;

    assert.equal(rejected.dataset.funkyCmsRejected, "true");
    assert.equal(rejected.dataset.funkyCmsExecuted, undefined);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /HTML instead of JavaScript/);
    cleanup();
  } finally {
    console.error = originalError;
  }
});

test("service worker caches a clone before returning the network response", () => {
  assert.match(serviceWorkerSource, /await cache\.put\(request, response\.clone\(\)\)/);
  assert.equal(serviceWorkerSource.match(/event\.respondWith\(/g)?.length, 2);
  assert.match(serviceWorkerSource, /const safeNetwork = network\.catch\(\(\) => null\)/);
  assert.match(serviceWorkerSource, /event\.waitUntil\(safeNetwork\.then/);
  assert.match(serviceWorkerSource, /cached \?\? await safeNetwork \?\? Response\.error\(\)/);
  assert.doesNotMatch(serviceWorkerSource, /cache\.put\(request, response\.clone\(\)\)\.catch/);
});

test("mountEnqueuedScripts accepts reviewed bundled behaviors and warns once for unknown scripts", () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    const scripts = [
      cmsScript("wc-add-to-cart"),
      cmsScript("woocommerce"),
      cmsScript("unreviewed-integration"),
      cmsScript("unreviewed-integration"),
    ];
    mountEnqueuedScripts(scripts);

    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /unreviewed-integration/);
  } finally {
    console.warn = originalWarn;
  }
});

function cmsScript(handle: string) {
  return {
    after: [],
    before: [],
    dependencies: null,
    groupLocation: null,
    handle,
    id: `${handle}-js`,
    src: null,
    strategy: null,
  };
}
