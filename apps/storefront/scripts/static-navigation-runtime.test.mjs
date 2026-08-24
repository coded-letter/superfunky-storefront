import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const runtimeSource = await readFile(
  new URL("../src/lib/staticNavigationRuntime.js", import.meta.url),
  "utf8",
);
assert.doesNotMatch(runtimeSource, /<\/script/i);

function createNavigationDocument() {
  return new JSDOM(`<!doctype html><html><body>
    <div data-prerendered-chrome>
      <header class="storefront-static-header" data-static-announcement-scroll="true">
        <nav>
          <span class="storefront-static-nav-item">
            <a href="/shop">Shop</a>
            <button type="button" data-static-submenu-toggle aria-expanded="false">Open</button>
            <div class="storefront-static-submenu" role="menu" aria-hidden="true">
              <a href="/shop/item" role="menuitem">Item</a>
            </div>
          </span>
        </nav>
      </header>
      <div data-static-header-spacer></div>
      <button type="button" data-static-mobile-toggle aria-expanded="false">Menu</button>
      <div data-static-mobile-backdrop hidden>
        <aside class="storefront-static-mobile-drawer" tabindex="-1">
          <button type="button" data-static-mobile-close>Close</button>
          <button type="button" data-static-mobile-expand aria-expanded="false" aria-controls="mobile-children">Expand</button>
          <div id="mobile-children" hidden><a href="/child">Child</a></div>
        </aside>
      </div>
      <script>${runtimeSource}</script>
    </div>
  </body></html>`, {
    pretendToBeVisual: true,
    runScripts: "dangerously",
    beforeParse(window) {
      window.scrollTo = () => undefined;
    },
  });
}

test("critical static navigation is interactive before application hydration", async () => {
  const dom = createNavigationDocument();
  const { document } = dom.window;
  const chrome = document.querySelector("[data-prerendered-chrome]");
  const mobileToggle = document.querySelector("[data-static-mobile-toggle]");
  const backdrop = document.querySelector("[data-static-mobile-backdrop]");
  const expand = document.querySelector("[data-static-mobile-expand]");
  const children = document.querySelector("#mobile-children");
  const submenuToggle = document.querySelector("[data-static-submenu-toggle]");
  const submenu = document.querySelector(".storefront-static-submenu");

  assert.equal(chrome?.dataset.staticNavigationReady, "true");
  assert.equal(dom.window.__funkyStorefrontStaticNavigation?.container, chrome);

  mobileToggle?.click();
  assert.equal(mobileToggle?.getAttribute("aria-expanded"), "true");
  assert.equal(backdrop?.hidden, false);
  assert.equal(backdrop?.classList.contains("is-open"), true);

  expand?.click();
  assert.equal(expand?.getAttribute("aria-expanded"), "true");
  assert.equal(children?.hidden, false);

  submenuToggle?.click();
  assert.equal(submenuToggle?.getAttribute("aria-expanded"), "true");
  assert.equal(submenu?.getAttribute("aria-hidden"), "false");

  dom.window.__funkyStorefrontStaticNavigation?.cleanup();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(chrome?.hasAttribute("data-static-navigation-ready"), false);
  assert.equal(dom.window.__funkyStorefrontStaticNavigation, undefined);
  assert.equal(backdrop?.hidden, true);

  dom.window.close();
});
