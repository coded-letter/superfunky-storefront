import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { activatePrerenderImages, restorePrerenderImage } from "./prerenderImages.ts";

test("restores deferred responsive image sources in fetch-safe order", () => {
  const dom = new JSDOM(`
    <img
      data-prerender-src="/hero.jpg"
      data-prerender-srcset="/hero-480.jpg 480w, /hero-1280.jpg 1280w"
      loading="lazy"
      decoding="async"
    >
  `);
  const image = dom.window.document.querySelector<HTMLImageElement>("img")!;

  restorePrerenderImage(image, true);

  assert.equal(image.getAttribute("srcset"), "/hero-480.jpg 480w, /hero-1280.jpg 1280w");
  assert.equal(image.getAttribute("src"), "/hero.jpg");
  assert.equal(image.loading, "eager");
  assert.equal(image.decoding, "sync");
  assert.equal(image.getAttribute("fetchpriority"), "high");
  assert.equal(image.hasAttribute("data-prerender-src"), false);
  assert.equal(image.hasAttribute("data-prerender-srcset"), false);
  dom.window.close();
});

test("falls back to native lazy loading and recovers failed optimized sources", () => {
  const dom = new JSDOM(`
    <main>
      <img
        data-prerender-src="/.netlify/images?url=photo.jpg&w=1024"
        data-prerender-srcset="/.netlify/images?url=photo.jpg&w=480 480w"
        data-prerender-fallback-src="https://cms.example/photo.jpg"
      >
    </main>
  `);
  const root = dom.window.document.querySelector<HTMLElement>("main")!;
  const image = root.querySelector<HTMLImageElement>("img")!;

  const cleanup = activatePrerenderImages(root);
  assert.equal(image.loading, "lazy");
  assert.equal(image.getAttribute("src"), "/.netlify/images?url=photo.jpg&w=1024");

  image.dispatchEvent(new dom.window.Event("error"));
  assert.equal(image.src, "https://cms.example/photo.jpg");
  assert.equal(image.hasAttribute("srcset"), false);
  assert.equal(image.hasAttribute("sizes"), false);
  assert.equal(image.hasAttribute("data-prerender-fallback-src"), false);

  cleanup();
  dom.window.close();
});

test("recovers a priority image that failed before the coordinator mounted", () => {
  const dom = new JSDOM(`
    <main>
      <img
        src="/.netlify/images?url=hero.jpg&w=1280"
        data-prerender-fallback-src="https://cms.example/hero.jpg"
      >
    </main>
  `);
  const root = dom.window.document.querySelector<HTMLElement>("main")!;
  const image = root.querySelector<HTMLImageElement>("img")!;
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 0 },
  });

  const cleanup = activatePrerenderImages(root);

  assert.equal(image.src, "https://cms.example/hero.jpg");
  assert.equal(image.hasAttribute("data-prerender-fallback-src"), false);
  cleanup();
  dom.window.close();
});

test("keeps a single visible image at high priority while restoring nearby images", () => {
  const dom = new JSDOM(`
    <main>
      <img src="/hero.jpg" fetchpriority="high">
      <img data-prerender-src="/gallery-a.jpg">
      <img data-prerender-src="/gallery-b.jpg">
    </main>
  `);
  const root = dom.window.document.querySelector<HTMLElement>("main")!;
  const [hero, galleryA, galleryB] = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const visibleBounds = { top: 100, bottom: 500 } as DOMRect;
  hero.getBoundingClientRect = () => visibleBounds;
  let callback: IntersectionObserverCallback | undefined;
  class FakeIntersectionObserver {
    constructor(nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(dom.window, "IntersectionObserver", {
    configurable: true,
    value: FakeIntersectionObserver,
  });

  const cleanup = activatePrerenderImages(root);
  callback?.([
    { isIntersecting: true, target: galleryA, boundingClientRect: visibleBounds },
    { isIntersecting: true, target: galleryB, boundingClientRect: visibleBounds },
  ] as IntersectionObserverEntry[], {} as IntersectionObserver);

  assert.equal(galleryA.getAttribute("src"), "/gallery-a.jpg");
  assert.equal(galleryA.getAttribute("fetchpriority"), null);
  assert.equal(galleryB.getAttribute("src"), "/gallery-b.jpg");
  assert.equal(galleryB.getAttribute("fetchpriority"), null);

  cleanup();
  dom.window.close();
});
