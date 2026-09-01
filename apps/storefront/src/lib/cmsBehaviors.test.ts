import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { mountCmsBehaviors, sanitizeCmsHtml, sanitizeCmsStyleAttribute } from "./cmsBehaviors.ts";
import { sanitizeWordPressGlobalStyles } from "./pageStyles.ts";

let dom: JSDOM;

async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for condition.");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  dom = new JSDOM(`
    <header id="main-header"></header>
    <main id="cms-root">
      <button id="docs-mobile-toggle">Menu</button>
      <nav id="doc-sidebar">
        <details><summary>Customisation</summary><div class="doc-links">
          <a href="/documentation/customisation/tailwind-css/">Tailwind</a>
          <a href="/documentation/customisation/styles-guide/">Styles</a>
        </div></details>
      </nav>
      <article id="docs-content"><h2>Getting started</h2><h2>Getting started</h2></article>
      <nav id="scroll-spy"><ul></ul></nav>
    </main>
  `, { url: "https://example.test/documentation/customisation/tailwind-css/", pretendToBeVisual: true });

  Object.assign(globalThis, {
    DOMParser: dom.window.DOMParser,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLImageElement: dom.window.HTMLImageElement,
    HTMLVideoElement: dom.window.HTMLVideoElement,
    location: dom.window.location,
    history: dom.window.history,
    sessionStorage: dom.window.sessionStorage,
    document: dom.window.document,
    window: dom.window,
  });
});

afterEach(() => dom.window.close());

test("media-library PDF and GLB assets stay on the storefront domain", () => {
  const html = sanitizeCmsHtml(`
    <a id="backend-pdf" href="https://dev.superfunky.pro/wp-content/uploads/2026/08/guide.pdf?download=1#page=2">Guide</a>
    <a-asset-item id="backend-model" src="https://dev.superfunky.pro/wp-content/uploads/2026/08/vending_machine.glb"></a-asset-item>
    <a id="external-pdf" href="https://cdn.example.test/guide.pdf">External</a>
  `);
  const root = document.createElement("div");
  root.innerHTML = html;

  assert.equal(
    root.querySelector<HTMLAnchorElement>("#backend-pdf")?.getAttribute("href"),
    "/wp-content/uploads/2026/08/guide.pdf?download=1#page=2",
  );
  assert.equal(
    root.querySelector("#backend-model")?.getAttribute("src"),
    "/wp-content/uploads/2026/08/vending_machine.glb",
  );
  assert.equal(
    root.querySelector<HTMLAnchorElement>("#external-pdf")?.getAttribute("href"),
    "https://cdn.example.test/guide.pdf",
  );
});

test("known docs behavior mounts after render and remounts after a route transition", () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  const cleanup = mountCmsBehaviors(root);

  assert.equal(document.querySelectorAll("#scroll-spy .spy-link").length, 2);
  assert.deepEqual(
    Array.from(document.querySelectorAll("#docs-content h2")).map((heading) => heading.id),
    ["getting-started", "getting-started-2"],
  );
  assert.equal(document.querySelector<HTMLAnchorElement>('a[href="/documentation/customisation/tailwind-css/"]')!.classList.contains("active"), true);

  cleanup();
  dom.reconfigure({ url: "https://example.test/documentation/customisation/styles-guide/" });
  Object.assign(globalThis, { location: dom.window.location, history: dom.window.history });
  const routeCleanup = mountCmsBehaviors(root);
  assert.equal(document.querySelector<HTMLAnchorElement>('a[href="/documentation/customisation/styles-guide/"]')!.classList.contains("active"), true);
  routeCleanup();
});

test("autoplay CMS videos are resumed on mount and when the page becomes visible", async () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.innerHTML = `<video autoplay loop src="https://example.test/uploads/intro.mp4"></video>`;
  const video = root.querySelector<HTMLVideoElement>("video");
  if (!video) throw new Error("Expected autoplay test video");

  let playCalls = 0;
  Object.defineProperty(video, "play", {
    configurable: true,
    value: () => {
      playCalls += 1;
      return Promise.resolve();
    },
  });

  const cleanup = mountCmsBehaviors(root);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.ok(playCalls >= 1);

  document.dispatchEvent(new dom.window.Event("visibilitychange"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(playCalls >= 2);

  cleanup();
});

test("native and standalone code use local Prism language and color selection", async () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.innerHTML = `
    <pre class="wp-block-code" data-code-theme="okaidia"><code class="language-js">const total = 2;</code></pre>
    <code class="js">const standalone = true;</code>
    <code class="rounded">ordinary inline code</code>
    <pre><code class="language-unknown">&lt;safe&gt;</code></pre>
    <pre class="no-copy"><code class="language-js">const privateSnippet = true;</code></pre>
  `;

  const cleanup = mountCmsBehaviors(root);
  await waitFor(() => root.querySelectorAll("code.language-javascript").length >= 2);
  const highlighted = root.querySelectorAll<HTMLElement>("code.language-javascript");
  const nested = highlighted[0];
  const standalone = highlighted[1];
  const firstHighlight = nested.innerHTML;

  assert.equal(highlighted.length, 3);
  assert.equal(nested.dataset.cmsHighlighted, "true");
  assert.match(firstHighlight, /token keyword/);
  assert.equal(nested.parentElement?.dataset.codeLanguage, "js");
  assert.equal(standalone.dataset.codeLanguage, "js");
  assert.equal(standalone.dataset.codeStandalone, "true");
  assert.match(standalone.innerHTML, /token keyword/);
  assert.equal(root.querySelector<HTMLElement>("code.rounded")?.dataset.cmsHighlighted, undefined);
  assert.equal(root.querySelector<HTMLElement>(".language-unknown")?.classList.contains("language-none"), true);
  assert.equal(root.querySelectorAll(".cms-code-copy").length, 2);
  assert.equal(root.querySelector(".no-copy .cms-code-copy"), null);
  const languageSelect = root.querySelector<HTMLSelectElement>(".cms-code-language-select");
  assert.equal(languageSelect?.value, "javascript");
  if (!languageSelect) throw new Error("Expected a local syntax highlighting selector");
  languageSelect.value = "typescript";
  languageSelect.dispatchEvent(new dom.window.Event("change"));
  assert.equal(nested.classList.contains("language-typescript"), true);
  assert.equal(nested.parentElement?.dataset.codeLanguage, "TypeScript");
  const themeSelect = root.querySelector<HTMLSelectElement>(".cms-code-theme-select");
  assert.equal(themeSelect?.value, "okaidia");
  if (!themeSelect) throw new Error("Expected a local syntax color selector");
  themeSelect.value = "twilight";
  themeSelect.dispatchEvent(new dom.window.Event("change"));
  assert.equal(nested.parentElement?.dataset.codeTheme, "twilight");
  document.documentElement.classList.toggle("dark");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nested.parentElement?.dataset.codeTheme, "twilight");
  document.documentElement.classList.remove("dark");

  cleanup();
  assert.equal(root.querySelector(".cms-code-controls"), null);
});

test("approved Superfunky documentation behavior tracks the heading in the viewport", () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.innerHTML = `
    <div data-superfunky-docs-page="setup/install.md" data-funky-behavior="docs-navigation">
      <div data-doc-article><h2 id="first">First</h2><h3 id="second">Second</h3></div>
      <aside><a href="#first" data-doc-toc-link data-active="true" aria-current="location">First</a>
        <a href="#second" data-doc-toc-link data-active="false">Second</a></aside>
    </div>
  `;
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h2, h3"));
  headings[0].getBoundingClientRect = () => ({ top: -120, bottom: -80 }) as DOMRect;
  headings[1].getBoundingClientRect = () => ({ top: 120, bottom: 160 }) as DOMRect;

  const cleanup = mountCmsBehaviors(root);
  document.dispatchEvent(new dom.window.Event("scroll", { bubbles: true }));

  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-doc-toc-link]"));
  assert.equal(links[0].dataset.active, "false");
  assert.equal(links[0].hasAttribute("aria-current"), false);
  assert.equal(links[1].dataset.active, "true");
  assert.equal(links[1].getAttribute("aria-current"), "location");

  cleanup();
  assert.equal(links[0].dataset.active, "true");
  assert.equal(links[0].getAttribute("aria-current"), "location");
  assert.equal(links[1].dataset.active, "false");
  assert.equal(links[1].hasAttribute("aria-current"), false);
});

test("sanitizer preserves Custom HTML scripts while removing executable attributes", () => {
  const html = sanitizeCmsHtml(`
    <p onclick="globalThis.cmsPayload = true">Safe text</p>
    <script data-wp-block-html="js">globalThis.cmsPayload = true</script>
    <iframe srcdoc="<script>alert(1)</script>"></iframe>
    <a href="javascript:alert(1)">unsafe link</a>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  assert.equal(parsed.querySelector("script")?.getAttribute("data-wp-block-html"), "js");
  assert.match(parsed.querySelector("script")?.textContent || "", /cmsPayload = true/);
  assert.equal(parsed.querySelector("[onclick]"), null);
  assert.equal(parsed.querySelector("[srcdoc]"), null);
  assert.equal(parsed.querySelector("a")?.hasAttribute("href"), false);
  assert.equal((globalThis as typeof globalThis & { cmsPayload?: boolean }).cmsPayload, undefined);
});

test("optimized CMS images fall back to their original source after an error", () => {
  dom.reconfigure({ url: "https://superfunky.pro/" });
  Object.assign(globalThis, { location: dom.window.location, window: dom.window });
  const originalSource = "https://blog.superfunky.pro/wp-content/uploads/new-photo.jpg";
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.innerHTML = sanitizeCmsHtml(`<img src="${originalSource}" alt="New photo">`);
  const image = root.querySelector<HTMLImageElement>("img")!;

  assert.match(image.src, /\/\.netlify\/images\?/);
  assert.equal(image.dataset.originalSrc, originalSource);
  assert.ok(image.hasAttribute("srcset"));

  const cleanup = mountCmsBehaviors(root);
  image.dispatchEvent(new dom.window.Event("error"));

  assert.equal(image.src, originalSource);
  assert.equal(image.hasAttribute("srcset"), false);
  assert.equal(image.hasAttribute("sizes"), false);
  assert.equal(image.dataset.originalSrc, undefined);
  cleanup();
});

test("sanitizer gives one meaningful raster image priority and lazily loads the rest", () => {
  const html = sanitizeCmsHtml(`
    <img src="/icon.png" width="32" height="32" loading="eager" fetchpriority="high">
    <img src="/decoration.svg" width="800" height="400">
    <img src="/hero.jpg" width="1200" height="800" loading="lazy">
    <img src="/gallery.jpg" width="800" height="600" loading="eager" fetchpriority="high">
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const [icon, decoration, hero, gallery] = Array.from(parsed.querySelectorAll("img"));

  assert.equal(icon.getAttribute("loading"), "lazy");
  assert.equal(icon.getAttribute("fetchpriority"), null);
  assert.equal(decoration.getAttribute("loading"), "lazy");
  assert.equal(hero.getAttribute("loading"), "eager");
  assert.equal(hero.getAttribute("decoding"), "sync");
  assert.equal(hero.getAttribute("fetchpriority"), "high");
  assert.equal(gallery.getAttribute("loading"), "lazy");
  assert.equal(gallery.getAttribute("decoding"), "async");
  assert.equal(gallery.getAttribute("fetchpriority"), null);
});

test("sanitizer keeps small editor images intrinsic instead of requesting viewport candidates", () => {
  dom.reconfigure({ url: "https://superfunky.pro/" });
  Object.assign(globalThis, { location: dom.window.location, window: dom.window });
  const html = sanitizeCmsHtml(`
    <img
      src="https://v3.superfunky.pro/wp-content/uploads/editor-icon.png"
      width="24"
      height="24"
      srcset="https://v3.superfunky.pro/wp-content/uploads/editor-icon.png 24w"
      sizes="100vw"
      alt=""
    >
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const image = parsed.querySelector<HTMLImageElement>("img")!;

  assert.match(image.getAttribute("src") || "", /\/\.netlify\/images\?/);
  assert.match(image.getAttribute("src") || "", /(?:\\?|&)w=24(?:&|$)/);
  assert.equal(image.getAttribute("width"), "24");
  assert.equal(image.getAttribute("height"), "24");
  assert.equal(image.hasAttribute("srcset"), false);
  assert.equal(image.hasAttribute("sizes"), false);
});

test("sanitizer preserves native Custom HTML CSS and JavaScript attributes", () => {
  const html = sanitizeCmsHtml(`
    <style data-wp-block-html="css">.backend-owned { color: rebeccapurple; }</style>
    <style data-wp-block-html="css" data-wp-block-supports="custom-css">
      .wp-custom-css-46372e02 { margin: auto; }
    </style>
    <script data-wp-block-html="js" type="module" nonce="editor-nonce" data-integration="example">
      globalThis.backendOwned = true;
    </script>
    <script data-wp-block-html="js" src="https://cdn.example.test/integration.js"
      async defer crossorigin="anonymous"></script>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const scripts = parsed.querySelectorAll("script");

  assert.match(parsed.querySelector("style")?.textContent || "", /\.backend-owned/);
  const blockCustomCss = parsed.querySelector('style[data-wp-block-supports="custom-css"]');
  assert.match(blockCustomCss?.textContent || "", /\.wp-custom-css-46372e02\s*\{\s*margin:\s*auto/);
  assert.equal(blockCustomCss?.getAttribute("data-wp-block-html"), "css");
  assert.equal(scripts[0].getAttribute("type"), "module");
  assert.equal(scripts[0].getAttribute("nonce"), "editor-nonce");
  assert.equal(scripts[0].getAttribute("data-integration"), "example");
  assert.equal(scripts[1].getAttribute("src"), "https://cdn.example.test/integration.js");
  assert.equal(scripts[1].hasAttribute("async"), true);
  assert.equal(scripts[1].hasAttribute("defer"), true);
  assert.equal(scripts[1].getAttribute("crossorigin"), "anonymous");
});

test("sanitizer preserves bounded Gutenberg and widget presentation styles", () => {
  const html = sanitizeCmsHtml(`
    <div style="height:70px; width: 18%; flex-basis:33.33%; border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); max-width: 1200px"></div>
    <iframe style="border-radius: 12px; width: 100%; height: 352px"></iframe>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  assert.equal(
    parsed.querySelector("div")?.getAttribute("style"),
    "height: 70px; width: 18%; flex-basis: 33.33%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); max-width: 1200px",
  );
  assert.equal(parsed.querySelector("iframe")?.getAttribute("style"), "border-radius: 12px; width: 100%; height: 352px");
});

test("sanitizer preserves native Spacer and outline Button block attributes", () => {
  const html = sanitizeCmsHtml(`
    <div style="height:45px" aria-hidden="true" class="wp-block-spacer"></div>
    <div class="wp-block-buttons is-layout-flex wp-block-buttons-is-layout-flex">
      <div class="wp-block-button is-style-outline is-style-outline--1">
        <a class="wp-block-button__link wp-element-button">Link two</a>
      </div>
    </div>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const spacer = parsed.querySelector(".wp-block-spacer");
  const button = parsed.querySelector(".wp-block-button");

  assert.equal(spacer?.getAttribute("style"), "height: 45px");
  assert.equal(spacer?.getAttribute("aria-hidden"), "true");
  assert.equal(button?.className, "wp-block-button is-style-outline is-style-outline--1");
  assert.equal(button?.querySelector("a")?.className, "wp-block-button__link wp-element-button");
});

test("sanitizer preserves native block typography controls", () => {
  const html = sanitizeCmsHtml(`
    <p style="font-family:var(--wp--preset--font-family--system); font-size:22px;
      font-style:italic; font-weight:700; letter-spacing:-0.02em; line-height:1.25;
      text-decoration:underline; text-indent:2rem; text-transform:uppercase;
      writing-mode:vertical-rl; column-count:3">Typography</p>
    <h2 style="font-size:clamp(33.419px, 2.089rem + ((1vw - 3.2px) * 3.021), 60px)">Fluid</h2>
    <p class="points" style="font-size:24pt">Points</p>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  assert.equal(
    parsed.querySelector("p")?.getAttribute("style"),
    "font-family: var(--wp--preset--font-family--system); font-size: 22px; font-style: italic; "
      + "font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; text-decoration: underline; "
      + "text-indent: 2rem; text-transform: uppercase; writing-mode: vertical-rl; column-count: 3",
  );
  assert.equal(
    parsed.querySelector("h2")?.getAttribute("style"),
    "font-size: clamp(33.419px, 2.089rem + ((1vw - 3.2px) * 3.021), 60px)",
  );
  assert.equal(parsed.querySelector(".points")?.getAttribute("style"), "font-size: 24pt");
  assert.equal(sanitizeCmsStyleAttribute("font-family: Comic Sans MS; column-count: 99; writing-mode: sideways-rl"), "");
  assert.equal(sanitizeCmsStyleAttribute("font-size: clamp(1px, url(https://attacker.test), 20px)"), "");
});

test("sanitizer preserves native decimal and fractional image aspect ratios", () => {
  const html = sanitizeCmsHtml(`
    <img class="portrait" style="aspect-ratio:0.46191177385569404; object-fit:contain; width:300px">
    <img class="landscape" style="aspect-ratio:4 / 3; object-fit:cover">
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  assert.equal(
    parsed.querySelector(".portrait")?.getAttribute("style"),
    "aspect-ratio: 0.46191177385569404; object-fit: contain; width: 300px",
  );
  assert.equal(
    parsed.querySelector(".landscape")?.getAttribute("style"),
    "aspect-ratio: 4 / 3; object-fit: cover",
  );
  assert.equal(sanitizeCmsStyleAttribute("aspect-ratio:0"), "");
  assert.equal(sanitizeCmsStyleAttribute("aspect-ratio:1/0"), "");
  assert.equal(sanitizeCmsStyleAttribute("aspect-ratio:calc(4 / 3)"), "");
});

test("sanitizer preserves native Group background image controls", () => {
  const html = sanitizeCmsHtml(`
    <div class="wp-block-group alignfull is-layout-flow has-background"
      style="min-height:300px; background-image:url('https://v3.superfunky.pro/wp-content/uploads/group.jpeg');
        background-position:center top; background-size:cover; background-repeat:no-repeat"></div>
    <div class="relative-background" style="background-image:url('/wp-content/uploads/group.webp'); background-size:50% auto"></div>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  assert.equal(
    parsed.querySelector(".wp-block-group")?.getAttribute("style"),
    "min-height: 300px; background-image: url('https://v3.superfunky.pro/wp-content/uploads/group.jpeg'); "
      + "background-position: center top; background-size: cover; background-repeat: no-repeat",
  );
  assert.equal(
    parsed.querySelector(".relative-background")?.getAttribute("style"),
    "background-image: url('/wp-content/uploads/group.webp'); background-size: 50% auto",
  );
  assert.equal(sanitizeCmsStyleAttribute("background-image:url(javascript:alert(1)); min-height:300px"), "");
  assert.equal(sanitizeCmsStyleAttribute("background-image:url(data:image/svg+xml,test)"), "");
});

test("sanitizer preserves native Cover custom corner radii", () => {
  const html = sanitizeCmsHtml(`
    <div class="wp-block-cover"
      style="border-top-left-radius:55px; border-top-right-radius:2rem;
        border-bottom-left-radius:25%; border-bottom-right-radius:clamp(8px, 2vw, 24px)">
      <img class="wp-block-cover__image-background">
      <span class="wp-block-cover__background"></span>
    </div>
  `);
  const cover = new DOMParser().parseFromString(html, "text/html").querySelector(".wp-block-cover");

  assert.equal(
    cover?.getAttribute("style"),
    "border-top-left-radius: 55px; border-top-right-radius: 2rem; "
      + "border-bottom-left-radius: 25%; border-bottom-right-radius: clamp(8px, 2vw, 24px)",
  );
});

test("sanitizer preserves native Cover overlay colors and custom gradients", () => {
  const html = sanitizeCmsHtml(`
    <div class="wp-block-cover">
      <span aria-hidden="true"
        class="wp-block-cover__background has-background-dim-70 has-background-dim has-background-gradient"
        style="background-color:#123456; background:linear-gradient(135deg, rgb(6, 147, 227) 0%, rgb(155, 81, 224) 100%)"></span>
    </div>
  `);
  const overlay = new DOMParser().parseFromString(html, "text/html").querySelector(".wp-block-cover__background");

  assert.equal(
    overlay?.getAttribute("style"),
    "background-color: #123456; background: linear-gradient(135deg, rgb(6, 147, 227) 0%, rgb(155, 81, 224) 100%)",
  );
  assert.equal(sanitizeCmsStyleAttribute("background:url(https://attacker.test/pixel)"), "");
  assert.equal(sanitizeCmsStyleAttribute("background:linear-gradient(red, url(https://attacker.test/pixel))"), "");
});

test("sanitizer preserves the Cover content-width global padding class", () => {
  const html = sanitizeCmsHtml(`
    <div class="wp-block-cover alignfull">
      <div class="wp-block-cover__inner-container has-global-padding is-layout-constrained wp-block-cover-is-layout-constrained">
        <p>Cover content</p>
      </div>
    </div>
  `);
  const inner = new DOMParser().parseFromString(html, "text/html").querySelector(".wp-block-cover__inner-container");

  assert.equal(
    inner?.className,
    "wp-block-cover__inner-container has-global-padding is-layout-constrained wp-block-cover-is-layout-constrained",
  );
});

test("sanitizer neutralizes CMS shell geometry while retaining component sizing", () => {
  const html = sanitizeCmsHtml(`
    <main class="wp-block-group container mx-auto px-4 2xl:max-w-7xl has-global-padding keep-me"
      style="width: 900px; max-width: 1200px; background-color: #fff">
      <div class="wp-block-group is-layout-constrained max-w-xl" style="max-width: 720px; padding: 20px"></div>
      <div class="sf-progress-bar" style="width: 18%; max-width: 420px; height: 6px"></div>
      <img style="width: 320px; max-width: 100%; height: 200px">
    </main>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const wrapper = parsed.body.firstElementChild;
  const group = wrapper?.querySelector(".wp-block-group");

  assert.equal(wrapper?.tagName, "DIV");
  assert.equal(wrapper?.className, "wp-block-group keep-me");
  assert.equal(wrapper?.getAttribute("style"), "background-color: #fff");
  assert.equal(group?.className, "wp-block-group is-layout-constrained max-w-xl");
  assert.equal(group?.getAttribute("style"), "max-width: 720px; padding: 20px");
  assert.equal(parsed.querySelector(".sf-progress-bar")?.getAttribute("style"), "width: 18%; max-width: 420px; height: 6px");
  assert.equal(parsed.querySelector("img")?.getAttribute("style"), "width: 320px; max-width: 100%; height: 200px");
});

test("WordPress Group layout sizes survive while the storefront shell remains separate", () => {
  const css = sanitizeWordPressGlobalStyles(`
    :root { --wp--style--global--content-size: 720px; --wp--style--global--wide-size: 1200px; --wp--preset--color--brand: #fff; }
    .is-layout-constrained > * { max-width: var(--wp--style--global--content-size); }
  `);

  assert.match(css, /--wp--style--global--content-size:\s*720px/);
  assert.match(css, /--wp--style--global--wide-size:\s*1200px/);
  assert.match(css, /--wp--preset--color--brand: #fff/);
});

test("sanitizer preserves native Group classes and generated layout CSS", () => {
  const html = sanitizeCmsHtml(`
    <div class="wp-block-group alignfull has-global-padding is-layout-grid wp-container-core-group-is-layout-abc123"
      style="min-width:320px; padding:24px">
      <div class="wp-block-group is-layout-flex is-vertical is-nowrap"></div>
    </div>
    <style data-wp-block-html="css" data-wp-block-supports="layout">
      .wp-container-core-group-is-layout-abc123 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        container-type: inline-size;
      }
      .wp-container-core-group-is-layout-abc123 > :first-child {
        grid-column: 1 / span 2;
        grid-row: 1 / span 2;
      }
    </style>
  `);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const group = parsed.querySelector(".wp-block-group.alignfull");
  const style = parsed.querySelector<HTMLStyleElement>("style[data-wp-block-supports='layout']");

  assert.equal(
    group?.className,
    "wp-block-group alignfull has-global-padding is-layout-grid wp-container-core-group-is-layout-abc123",
  );
  assert.equal(group?.getAttribute("style"), "min-width: 320px; padding: 24px");
  assert.match(style?.textContent || "", /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(style?.textContent || "", /container-type:\s*inline-size/);
  assert.match(style?.textContent || "", /grid-column:\s*1\s*\/\s*span\s*2/);
});

test("sanitizer rejects CSS exfiltration, parser escapes, and deceptive overlays", () => {
  const style = sanitizeCmsStyleAttribute(`
    height: 35px;
    background-image: url(https://attacker.test/pixel);
    color: red\\75;
    position: fixed;
    inset: 0;
    z-index: 999999;
    behavior: url(x.htc);
    -moz-binding: url(xbl.xml#x);
    width: expression(alert(1));
  `);

  assert.equal(style, "");
  assert.equal(sanitizeCmsStyleAttribute("height: 99999px; width: 101vw; opacity: 2"), "");
  assert.equal(sanitizeCmsStyleAttribute("@import 'https://attacker.test/a.css'; height: 35px"), "");
});

test("unknown behavior IDs are ignored and reported without executing content", () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.dataset.funkyBehavior = "not-approved";
  const messages: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message) => messages.push(String(message));
  try {
    mountCmsBehaviors(root)();
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(messages.some((message) => message.includes('unsupported CMS behavior "not-approved"')), true);
});

test("mounting is idempotent and cleanup removes generated DOM and listeners", () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  const cleanup = mountCmsBehaviors(root);
  const duplicateCleanup = mountCmsBehaviors(root);
  assert.equal(document.querySelectorAll("#scroll-spy .spy-link").length, 2);
  assert.equal(document.querySelectorAll("#docs-content .heading-anchor").length, 2);

  duplicateCleanup();
  cleanup();
  assert.equal(document.querySelectorAll("#scroll-spy .spy-link").length, 0);
  assert.equal(document.querySelectorAll("#docs-content .heading-anchor").length, 0);

  document.querySelector<HTMLButtonElement>("#docs-mobile-toggle")!.click();
  assert.equal(document.querySelector("#doc-sidebar")!.classList.contains("docs-mobile-open"), false);
});

test("known bundled homepage behaviors still mount independently of editor scripts", async () => {
  const root = document.querySelector<HTMLElement>("#cms-root")!;
  root.insertAdjacentHTML("beforeend", `
    <div id="gml-map"></div>
    <button id="openNewsletterBtn">Join the Waitlist</button>
    <div id="newsletterOverlay"></div>
    <div id="orbital-wrapper"><div class="orbit ring-1"></div></div>
  `);

  const cleanup = mountCmsBehaviors(root);
  await new Promise((resolve) => setTimeout(resolve, 180));

  assert.equal(document.querySelector<HTMLAnchorElement>("#gml-map a")?.hostname, "www.google.com");
  assert.equal(document.querySelector<HTMLDivElement>("#newsletterOverlay")?.hidden, true);
  assert.equal(document.querySelector("#orbital-wrapper")?.classList.contains("cms-home-orbital"), true);

  document.querySelector<HTMLButtonElement>("#openNewsletterBtn")!.click();
  assert.equal(window.location.hash, "#newsletter");
  window.dispatchEvent(new dom.window.MouseEvent("pointermove", { clientX: 1, clientY: 1 }));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  assert.equal(document.querySelector("#orbital-wrapper")?.classList.contains("cms-orbital-tilt-0-0"), true);

  cleanup();
  assert.equal(document.querySelector("#gml-map")?.children.length, 0);
  assert.equal(document.querySelector<HTMLDivElement>("#newsletterOverlay")?.hidden, false);
  assert.equal(document.querySelector("#orbital-wrapper")?.classList.contains("cms-home-orbital"), false);
});
