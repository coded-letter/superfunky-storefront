import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { build } from "vite";

let outputDirectory;
let PostGrid;
let ProductGrid;
let AppStateProvider;
let ArchivePaginationProvider;
const observers = new Set();

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), "storefront-archive-pagination-"));
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(outputDirectory, "node_modules"), "dir");
  const ui = fileURLToPath(new URL("../../../packages/ui/src", import.meta.url));
  await build({
    configFile: false,
    logLevel: "error",
    root: fileURLToPath(new URL("../../../", import.meta.url)),
    esbuild: { jsx: "automatic" },
    ssr: { noExternal: ["@funky/ui", "@funky/shared"] },
    plugins: [{
      name: "archive-pagination-fixture",
      resolveId: (id) => id === "archive-pagination-fixture" ? id : null,
      load: (id) => id === "archive-pagination-fixture" ? `
        export { PaginablePostGrid as PostGrid } from ${JSON.stringify(`${ui}/blog/PaginablePostGrid.tsx`)};
        export { PaginableProductGrid as ProductGrid } from ${JSON.stringify(`${ui}/catalog/PaginableProductGrid.tsx`)};
        export { AppStateProvider } from ${JSON.stringify(`${ui}/state/AppStateProvider.tsx`)};
        export { ArchivePaginationProvider } from ${JSON.stringify(`${ui}/state/ArchivePaginationContext.tsx`)};
      ` : null,
    }],
    build: {
      ssr: true,
      outDir: outputDirectory,
      emptyOutDir: false,
      rollupOptions: {
        input: "archive-pagination-fixture",
        external: /^(?:react|react-dom|react-router|react-router-dom|lucide-react)(?:\/|$)/,
        output: { entryFileNames: "fixture.mjs" },
      },
    },
  });
  ({ PostGrid, ProductGrid, AppStateProvider, ArchivePaginationProvider } = await import(pathToFileURL(join(outputDirectory, "fixture.mjs"))));
});

after(async () => { if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true }); });

async function mountGrid(kind, count, settings, pageSize) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://storefront.test/" });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  });
  const items = Array.from({ length: count }, (_, index) => kind === "post" ? {
    id: String(index + 1), slug: `item-${index + 1}`, title: `Item ${index + 1}`,
    excerpt: "", date: "2026-01-01", author: { name: "Author" }, wordCount: 100,
  } : { id: String(index + 1), name: `Item ${index + 1}`, priceLabel: "$10", priceAmount: 10 });
  const root = createRoot(document.getElementById("root"));
  const render = async (value) => {
    await React.act(async () => root.render(
      React.createElement(MemoryRouter, null,
        React.createElement(AppStateProvider, null,
          React.createElement(ArchivePaginationProvider, { value },
            React.createElement(kind === "post" ? PostGrid : ProductGrid, {
              [kind === "post" ? "posts" : "products"]: items,
              showFilters: false,
              cardVariant: "minimal",
              pageSize,
            }),
          ),
        ),
      ),
    ));
  };
  await render(settings);
  return {
    render,
    cards: () => [...document.querySelectorAll(`.sf-${kind}-card`)],
    click: async (selector, text) => {
      const button = [...document.querySelectorAll(selector)].find((candidate) => text === undefined || candidate.textContent.trim() === text);
      assert.ok(button, `missing button: ${selector}`);
      await React.act(async () => button.click());
    },
    close: async () => {
      await React.act(async () => root.unmount());
      dom.window.close();
      observers.clear();
    },
  };
}

for (const kind of ["post", "product"]) {
  test(`${kind} grids use distinct native sizes on every numbered page and infinite batch`, async () => {
    const size = kind === "post" ? 7 : 11;
    const grid = await mountGrid(kind, 27, { postsPerPage: 7, productsPerPage: 11 });
    try {
      assert.equal(grid.cards().length, size);
      await grid.click("nav button", "2");
      assert.equal(grid.cards().length, size);
      assert.match(grid.cards()[0].textContent, new RegExp(`Item ${size + 1}(?!\\d)`));
      await grid.click('[role="tab"]:nth-child(2)');
      assert.equal(grid.cards().length, size);
      await React.act(async () => {
        for (const observer of observers) observer.callback([{ isIntersecting: true }]);
      });
      assert.equal(grid.cards().length, size * 2);
      await grid.render({ postsPerPage: 5, productsPerPage: 5 });
      assert.equal(grid.cards().length, 5, "native settings changes reset infinite progress");
      await grid.click('[role="tab"]:first-child');
      assert.equal(grid.cards().length, 5);
      await grid.click("nav button", "6");
      assert.equal(grid.cards().length, 2, "the last page includes the remaining archive items");
    } finally {
      await grid.close();
    }
  });

  test(`${kind} grids preserve explicit editorial sizes and support native unlimited archives`, async () => {
    const override = await mountGrid(kind, 17, { postsPerPage: 7, productsPerPage: 11 }, 3);
    try { assert.equal(override.cards().length, 3); } finally { await override.close(); }
    const unlimited = await mountGrid(kind, 17, { postsPerPage: -1, productsPerPage: -1 });
    try { assert.equal(unlimited.cards().length, 17); } finally { await unlimited.close(); }
  });

  test(`${kind} grids wait for native settings and surface settings failures`, async () => {
    const grid = await mountGrid(kind, 17, { postsPerPage: 7, productsPerPage: 11, isLoading: true });
    try {
      assert.equal(grid.cards().length, 0);
      assert.ok(document.querySelector('[role="status"]'));
      await grid.render({ postsPerPage: 7, productsPerPage: 11, error: new Error("Settings unavailable") });
      assert.equal(grid.cards().length, 0);
      assert.ok(document.querySelector('[role="alert"]'));
      await grid.render({ postsPerPage: 7, productsPerPage: 11 });
      assert.equal(grid.cards().length, kind === "post" ? 7 : 11);
    } finally {
      await grid.close();
    }
  });
}
