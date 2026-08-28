import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  afterMountedPageStylesSettle,
  applyThemePresetVariables,
  createWordPressElementTypographyCss,
  mountPageStyles,
  sanitizeWordPressFontFaces,
  sanitizeWordPressStylesheetUrls,
  WORDPRESS_BLOCK_COMPATIBILITY_CSS,
} from "./pageStyles.ts";
import { staticStyleSourceHash } from "./staticStyleContract.mjs";

const bundledCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const photoHeroSource = readFileSync(new URL("../components/HeroMock.tsx", import.meta.url), "utf8");
const videoHeroSource = readFileSync(new URL("../components/VideoHero.tsx", import.meta.url), "utf8");

test("page style readiness waits for every CMS stylesheet chunk", () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  const previousDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  try {
    const first = dom.window.document.createElement("link");
    const second = dom.window.document.createElement("link");
    for (const link of [first, second]) {
      link.rel = "stylesheet";
      link.dataset.wordpressPageStyle = "wordpress-block-library";
      dom.window.document.head.appendChild(link);
    }
    let settled = false;
    const stopWaiting = afterMountedPageStylesSettle(() => {
      settled = true;
    });

    first.dispatchEvent(new dom.window.Event("load"));
    assert.equal(settled, false);
    second.dispatchEvent(new dom.window.Event("load"));
    assert.equal(settled, true);
    stopWaiting();
  } finally {
    if (previousDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", previousDocumentDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
    dom.window.close();
  }
});

test("bundled and hydrated CSS implement the same full-width breakout", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.entry-content\s*>\s*\.alignfull,[\s\S]{0,180}?\{[\s\S]*?inline-size:\s*100vw\s*!important/);
    assert.match(css, /margin-inline:\s*calc\(50%\s*-\s*50vw\)\s*!important/);
    assert.match(css, /@supports\s*\(inline-size:\s*100cqi\)/);
    assert.match(css, /inline-size:\s*100cqi\s*!important/);
    assert.match(css, /margin-inline:\s*calc\(50%\s*-\s*50cqi\)\s*!important/);
  }
});

test("top-level wide/full and nested Group alignment semantics stay explicit", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.entry-content\s*>\s*\.alignwide,[\s\S]{0,180}?\{[\s\S]*?--funky-shell-inner-width/);
    assert.match(css, /\.entry-content\s*>\s*\.alignfull,[\s\S]{0,180}?\{[\s\S]*?inline-size:\s*100vw\s*!important/);
    assert.match(css, /\.entry-content\s*>\s*\.wp-content-fragment\s*>\s*\.alignfull/);
    assert.match(css, /\.alignfull \.alignfull\s*\{[\s\S]*?inline-size:\s*100%\s*!important/);
    assert.match(css, /\.alignfull \.alignwide\s*\{[\s\S]*?margin-inline:\s*auto\s*!important/);
    assert.match(css, /\.wp-block-group\.is-layout-constrained\s*>\s*:not\(\.alignwide\):not\(\.alignfull\)/);
    assert.match(css, /--wp--style--global--content-size:\s*var\(--funky-content-max-width,\s*1280px\)/);
    assert.match(css, /max-inline-size:\s*var\(--wp--style--global--content-size,\s*var\(--funky-content-max-width,\s*1280px\)\)/);
    assert.match(css, /\.wp-block-group\.is-layout-constrained\s*>\s*\.alignwide/);
    assert.match(css, /max-inline-size:\s*var\(--wp--style--global--wide-size,\s*1200px\)/);
  }
});

test("Group Row, Stack, and Grid controls retain native layout semantics", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.is-layout-flex\s*\{[\s\S]*?display:\s*flex/);
    assert.match(css, /\.is-layout-flex\.is-vertical\s*\{[\s\S]*?flex-direction:\s*column/);
    assert.match(css, /\.is-layout-flex\.is-nowrap\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
    assert.match(css, /\.is-layout-flex:not\(\.is-vertical\)\.is-content-justification-space-between/);
    assert.match(css, /\.is-layout-flex\.is-vertical\.is-content-justification-center\s*\{[\s\S]*?align-items:\s*center/);
    assert.match(css, /\.is-layout-flex\.is-vertical\.are-vertically-aligned-bottom\s*\{[\s\S]*?justify-content:\s*flex-end/);
    assert.match(css, /\.is-layout-grid\s*\{[\s\S]*?display:\s*grid/);
    assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(12rem,\s*100%\),\s*1fr\)\)/);
  }
});

test("centered images and desktop Columns retain native WordPress layout semantics", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.wp-block-image\.aligncenter\s*>\s*:where\(img,\s*a\s*>\s*img\)\s*\{[\s\S]*?margin-inline:\s*auto/);
    assert.doesNotMatch(css, /\.entry-content\s+\.aligncenter\s*\{/);
    assert.doesNotMatch(css, /\.wp-block-icon[^,{]*\{[^}]*margin-inline:\s*auto/);
    assert.match(css, /@media\s*\(min-width:\s*782px\)\s*\{[\s\S]*?\.wp-block-columns\s*\{[\s\S]*?flex-wrap:\s*nowrap\s*!important/);
    assert.match(css, /\[data-funkycommerce-render-slot\][\s\S]{0,180}?max-inline-size:\s*100%/);
    assert.match(css, /\[data-rendered-cms-shortcode\][\s\S]{0,220}?min-inline-size:\s*0/);
  }
});

test("editor icon blocks have low-specificity first-paint geometry", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /:where\(\.wp-site-blocks\.entry-content \.wp-block-icon\)\s*\{[\s\S]{0,180}--funky-cms-inline-icon-size:\s*24px[\s\S]{0,180}line-height:\s*0/);
    assert.match(css, /:where\(\.wp-site-blocks\.entry-content \.wp-block-icon\.aligncenter\)\s*\{[\s\S]{0,120}display:\s*flex[\s\S]{0,120}justify-content:\s*center/);
    assert.match(css, /:where\(\.wp-site-blocks\.entry-content \.wp-block-icon > svg\)\s*\{[\s\S]{0,300}height:\s*auto[\s\S]{0,180}max-height:\s*var\(--funky-cms-inline-icon-size,\s*24px\)[\s\S]{0,180}max-width:\s*var\(--funky-cms-inline-icon-size,\s*24px\)[\s\S]{0,120}width:\s*auto/);
  }
});

test("basic WordPress button variants use the theme accent without underlines", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.wp-block-button__link[\s\S]{0,600}border-radius:\s*var\(--theme-radius\)/);
    assert.match(css, /\.wp-block-button:not\(\.is-style-outline\)[\s\S]*?background-color:\s*rgb\(var\(--brand-600\)\)\s*!important/);
    assert.match(css, /\.wp-block-button:is\(\.is-style-outline,\s*\[class\*="is-style-outline--"\]\)[\s\S]*?border-width:\s*1px\s*!important/);
    assert.match(css, /\.wp-block-button:is\(\.is-style-outline,\s*\[class\*="is-style-outline--"\]\)[\s\S]*?color:\s*rgb\(var\(--brand-600\)\)\s*!important/);
    assert.match(css, /:where\(\.wp-block-button__link,\s*\.wp-element-button\):is\(:hover,\s*:focus,\s*:active,\s*:visited\)\s*\{[\s\S]*?text-decoration:\s*none\s*!important/);
  }
});

test("constrained Cover blocks inherit the theme radius while full-bleed covers stay square", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(
      css,
      /\.wp-block-cover:not\(\.alignfull\):not\(\[style\*="border-radius"\]\):not\(\[style\*="border-top-left-radius"\]\)[\s\S]{0,300}border-radius:\s*var\(--theme-radius\)/,
    );
    assert.match(
      css,
      /\.wp-block-cover\.alignfull:not\(\[style\*="border-radius"\]\)[\s\S]{0,300}border-radius:\s*0/,
    );
    assert.match(
      css,
      /\.wp-block-cover[\s\S]{0,120}>\s*:where\([\s\S]{0,300}\.wp-block-cover__image-background[\s\S]{0,300}border-radius:\s*inherit\s*!important/,
    );
  }
});

test("photo and video heroes use theme radius only when width-constrained", () => {
  assert.match(photoHeroSource, /borderRadius: fullWidth \? 0 : "var\(--theme-radius\)"/);
  assert.doesNotMatch(photoHeroSource, /fullWidth \?[^:\n]+:\s*"rounded-(?:2xl|3xl)"/);
  assert.match(videoHeroSource, /borderRadius: variant === "fullbleed" \? 0 : "var\(--theme-radius\)"/);
  assert.doesNotMatch(videoHeroSource, /variant === "fullbleed" \? "rounded-none/);
  assert.equal(videoHeroSource.match(/absolute inset-0 !h-full w-full object-cover/g)?.length, 2);
});

test("posterless video heroes defer heavy media until visitor interaction", () => {
  assert.match(videoHeroSource, /const mediaActivated = !resolved \|\| Boolean\(poster\) \|\| activatedMediaSource === source/);
  assert.match(videoHeroSource, /window\.__funkyStorefrontMediaActivationRequested === true/);
  assert.match(videoHeroSource, /const events = \["pointerdown", "keydown", "touchstart", "wheel"\] as const/);
  assert.match(videoHeroSource, /target\.closest\("\[data-video-hero-control\]"\)/);
  assert.match(videoHeroSource, /removeActivationListeners\(\);\s*setActivatedMediaSource\(source\)/);
  assert.doesNotMatch(videoHeroSource, /addEventListener\(eventName, activateMedia, \{ passive: true, once: true \}\)/);
  assert.match(videoHeroSource, /src=\{mediaActivated \? resolved\.url : undefined\}/);
  assert.match(videoHeroSource, /preload=\{mediaActivated \? "auto" : "none"\}/);
  assert.match(videoHeroSource, /autoPlay=\{playbackActive\}/);
  assert.match(videoHeroSource, /reducedMotion\.addEventListener\("change", applyReducedMotion\)/);
  assert.match(videoHeroSource, /reducedMotion\.removeEventListener\("change", applyReducedMotion\)/);
  assert.match(videoHeroSource, /video\.play\(\)\.catch\(\(\) => setPlaying\(false\)\)/);
  assert.match(videoHeroSource, /onPlay=\{\(\) => setPlaying\(true\)\}/);
  assert.match(videoHeroSource, /onPause=\{\(\) => setPlaying\(false\)\}/);
  assert.match(videoHeroSource, /onEnded=\{\(\) => setPlaying\(false\)\}/);
  assert.match(
    bundledCss,
    /\[data-funkycommerce-fullwidth="true"\][\s\S]{0,220}:where\(\.sf-hero,\s*\.wp-block-cover\)[\s\S]{0,100}border-radius:\s*0\s*!important/,
  );
});

test("Cover content width and overlay controls match Gutenberg output", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(
      css,
      /\.wp-block-cover__inner-container\.is-layout-constrained\s*>\s*:not\(\.alignwide\):not\(\.alignfull\)[\s\S]{0,300}max-inline-size:\s*var\(--wp--style--global--content-size/,
    );
    assert.match(
      css,
      /\.wp-block-cover__inner-container\.is-layout-constrained\s*>\s*\.alignwide[\s\S]{0,300}max-inline-size:\s*var\(--wp--style--global--wide-size,\s*1200px\)/,
    );
    assert.match(
      css,
      /\.wp-block-cover__inner-container\s*\{[\s\S]{0,400}box-sizing:\s*border-box[\s\S]{0,400}max-inline-size:\s*var\(--wp--style--global--content-size[\s\S]{0,400}padding-left:\s*var\(--wp--style--root--padding-left,\s*var\(--funky-shell-gutter,\s*1rem\)\)[\s\S]{0,400}padding-right:\s*var\(--wp--style--root--padding-right,\s*var\(--funky-shell-gutter,\s*1rem\)\)/,
    );
    assert.match(css, /\.wp-block-cover__background\s*\{[\s\S]{0,160}position:\s*absolute/);
    assert.match(css, /\.wp-block-cover__background\.has-background-gradient\s*\{[\s\S]{0,100}background-color:\s*transparent/);
    assert.match(css, /\.wp-block-cover__image-background,[\s\S]{0,120}\.wp-block-cover__video-background\s*\{/);
    for (let dim = 0; dim <= 100; dim += 10) {
      assert.match(
        css,
        new RegExp(`\\.wp-block-cover__background\\.has-background-dim-${dim}\\s*\\{\\s*opacity:\\s*${dim / 100}(?:\\.0)?;?\\s*\\}`),
      );
    }
  }
});

test("CMS text wraps while code and wide tables remain locally scrollable", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.wp-site-blocks\.entry-content\s*\{[\s\S]{0,180}min-width:\s*0[\s\S]{0,180}overflow-wrap:\s*anywhere/);
    assert.match(css, /\.wp-site-blocks\.entry-content pre\s*\{[\s\S]{0,220}max-width:\s*100%[\s\S]{0,220}overflow-x:\s*auto[\s\S]{0,220}white-space:\s*pre/);
    assert.match(css, /\.wp-site-blocks\.entry-content code\s*\{[\s\S]{0,260}max-width:\s*100%[\s\S]{0,260}overflow-x:\s*auto[\s\S]{0,260}white-space:\s*pre/);
    assert.match(css, /\.wp-site-blocks\.entry-content table\s*\{[\s\S]{0,180}overflow-x:\s*auto/);
  }
});

test("Global Styles typography outranks shell utilities but leaves block overrides authoritative", () => {
  const css = createWordPressElementTypographyCss(`
    body { color: red; font-family: var(--wp--preset--font-family--body); font-size: var(--wp--preset--font-size--small); line-height: 1.4; }
    a:where(:not(.wp-element-button)) { font-family: inherit; font-size: 1rem; letter-spacing: 0.02em; }
    h1, h2, h3, h4, h5, h6 { font-family: var(--wp--preset--font-family--heading); font-weight: 900; line-height: 1.2; }
    h1 { font-size: 42px; text-transform: uppercase; }
    :root :where(.wp-block-heading) { margin-block-start: var(--wp--preset--spacing--30); margin-block-end: 8px; }
    :root :where(.wp-block-paragraph) { margin-top: 4px; margin-bottom: var(--wp--preset--spacing--20); }
    :root :where(.wp-element-caption, figcaption) { font-size: 13px; font-style: italic; }
    :root :where(.wp-element-button, .wp-block-button__link) { font-size: inherit; font-weight: 600; }
  `);

  assert.match(css, /body\{font-family:var\(--wp--preset--font-family--body\)!important\}/);
  assert.match(css, /\.wp-site-blocks\.entry-content\{font-size:var\(--wp--preset--font-size--small\)!important\}/);
  assert.match(css, /:where\(h1\):not\(\.has-custom-css\):not\(\[class\*="-font-size"\]\):not\(\[style\*="font-size"\]\)\{font-size:42px!important\}/);
  assert.match(css, /:where\(h2\):not\(\.has-custom-css\):not\(\[style\*="font-weight"\]\)\{font-weight:900!important\}/);
  assert.match(css, /:where\(a:not\(\.wp-element-button\):not\(\.wp-block-button__link\)\):not\(\.has-custom-css\):not\(\[style\*="letter-spacing"\]\)\{letter-spacing:0\.02em!important\}/);
  assert.match(css, /:where\(figcaption, \.wp-element-caption, caption\):not\(\.has-custom-css\):not\(\[style\*="font-style"\]\)\{font-style:italic!important\}/);
  assert.match(css, /:where\(\.wp-element-button, \.wp-block-button__link\):not\(\.has-custom-css\):not\(\[style\*="font-weight"\]\)\{font-weight:600!important\}/);
  assert.match(css, /body :where\(h1,h2,h3,h4,h5,h6,\.wp-block-heading,\.funky-brand-heading\):not\(\.has-custom-css\)\{font-family:var\(--wp--preset--font-family--heading\)!important\}/);
  assert.match(css, /:where\(\.wp-site-blocks\.entry-content h1\):not\(\[style\*="margin"\]\)\{margin-block-start:var\(--wp--preset--spacing--30\)\}/);
  assert.match(css, /:where\(\.wp-site-blocks\.entry-content h6\):not\(\[style\*="margin"\]\)\{margin-block-end:8px\}/);
  assert.match(css, /:where\(\.wp-site-blocks\.entry-content p\):not\(\[style\*="margin"\]\)\{margin-top:4px\}/);
  assert.match(css, /:where\(\.wp-site-blocks\.entry-content p\):not\(\[style\*="margin"\]\)\{margin-bottom:var\(--wp--preset--spacing--20\)\}/);
  assert.doesNotMatch(css, /color:red!important/);
});

test("WordPress text blocks have minimal fallback margins in bundled and hydrated CSS", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /:where\([\s\S]*?\.wp-site-blocks\.entry-content h1,[\s\S]*?\.wp-site-blocks\.entry-content h6[\s\S]*?\):not\(\[style\*="margin"\]\)\s*\{[\s\S]*?margin-block:\s*0\.5em 0\.3em/);
    assert.match(css, /:where\(\.wp-site-blocks\.entry-content p\):not\(\[style\*="margin"\]\)\s*\{[\s\S]*?margin-block:\s*0\.35em/);
    assert.doesNotMatch(css, /margin-block:\s*(?:0\.5em 0\.3em|0\.35em)\s*!important/);
  }
});

test("generated fluid preset variables are not replaced by static typed fallbacks", () => {
  const dom = new JSDOM("<html><head></head><body></body></html>");
  Object.assign(globalThis, { document: dom.window.document });
  const cleanup = applyThemePresetVariables({
    customCss: "",
    fontFaceStyles: "",
    globalStyles: ":root{--wp--preset--font-size--medium:clamp(14px, 2vw, 20px)}",
    stylesheets: [],
    colors: [],
    fontFamilies: [],
    fontSizes: [
      { slug: "medium", name: "Medium", size: "20px" },
      { slug: "display", name: "Display", size: "64px" },
    ],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  });

  assert.equal(document.documentElement.style.getPropertyValue("--wp--preset--font-size--medium"), "");
  assert.equal(document.documentElement.style.getPropertyValue("--wp--preset--font-size--display"), "64px");
  cleanup();
  assert.equal(document.documentElement.style.getPropertyValue("--wp--preset--font-size--display"), "");
  dom.window.close();
});

test("Layout Studio owns top-level alignment and constrained Group content width", () => {
  for (const css of [bundledCss, WORDPRESS_BLOCK_COMPATIBILITY_CSS]) {
    assert.match(css, /\.entry-content\s*>\s*\.alignwide,[\s\S]{0,180}?\{[\s\S]*?var\(--funky-shell-inner-width\)/);
    assert.match(css, /--wp--style--global--content-size:\s*var\(--funky-content-max-width,\s*1280px\)/);
    assert.match(css, /var\(--wp--style--global--wide-size,\s*1200px\)/);
  }
});

test("rejects unversioned, malformed, and external theme font sources", () => {
  const css = [
    `@font-face{font-family:Broken;src:url("https://cms.example/?funkycommerce_font=broken.woff2") format("woff2")}`,
    `@font-face{font-family:External;src:url("https://cdn.example/font.woff2") format("woff2")}`,
    `@font-face{font-family:Mismatch;src:url("https://cms.example/?funkycommerce_font=font.ttf&funkycommerce_font_v=3") format("woff2")}`,
    `@font-face{font-family:Stale;src:url("https://cms.example/?funkycommerce_font=font.woff2&funkycommerce_font_v=1") format("woff2")}`,
  ].join("\n");
  assert.equal(sanitizeWordPressFontFaces(css), "");
});

test("normalizes, deduplicates, and bounds validated theme font faces", () => {
  const face = (family: string, weight: number, filename = `${family}-${weight}.woff2`, version = "3") =>
    `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:fallback;src:url("https://cms.example/?funkycommerce_font=${filename}&funkycommerce_font_v=${version}") format("woff2");}`;
  const css = [
    face("Brand", 400),
    face("Brand", 400, "duplicate.woff2"),
    face("Legacy", 400, "legacy.woff2", "2"),
    ...Array.from({ length: 10 }, (_, index) => face(`Family${index}`, 400)),
  ].join("\n");
  const normalized = sanitizeWordPressFontFaces(css);

  assert.equal((normalized.match(/@font-face/g) || []).length, 8);
  assert.equal((normalized.match(/font-family:"Brand"/g) || []).length, 1);
  assert.doesNotMatch(normalized, /duplicate\.woff2/);
  assert.match(normalized, /legacy\.woff2/);
  assert.doesNotMatch(normalized, /font-display:fallback/);
  assert.match(normalized, /font-display:swap/);
});

test("accepts only versioned WordPress core block stylesheets from the configured backend", () => {
  assert.deepEqual(
    sanitizeWordPressStylesheetUrls([
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/theme.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2&redirect=https://attacker.test",
      "https://attacker.test/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
    ], "https://v3.superfunky.pro/graphql"),
    [
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/theme.min.css?ver=7.0.2",
    ],
  );
});

test("mounts core block styles after global defaults and before editor custom CSS", () => {
  const dom = new JSDOM("<html><head></head><body></body></html>");
  Object.assign(globalThis, { document: dom.window.document });
  const cleanup = mountPageStyles({
    customCss: ".editor-rule{color:red}",
    fontFaceStyles: "",
    globalStyles: ":root :where(.wp-element-button){background:#32373c}",
    stylesheets: [
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/theme.min.css?ver=7.0.2",
    ],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  }, "https://v3.superfunky.pro/graphql");

  assert.deepEqual(
    Array.from(document.head.querySelectorAll<HTMLElement>("[data-wordpress-page-style]"))
      .map((element) => element.dataset.wordpressPageStyle),
    [
      "wordpress-global-styles",
      "wordpress-block-library",
      "wordpress-block-library",
      "wordpress-custom-css",
      "wordpress-block-compatibility",
    ],
  );

  const secondCleanup = mountPageStyles({
    customCss: "",
    fontFaceStyles: "",
    globalStyles: ":root :where(.wp-element-button){border-width:0}",
    stylesheets: [
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/theme.min.css?ver=7.0.2",
    ],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  }, "https://v3.superfunky.pro/graphql");

  assert.deepEqual(
    Array.from(document.head.querySelectorAll<HTMLElement>("[data-wordpress-page-style]"))
      .map((element) => element.dataset.wordpressPageStyle),
    [
      "wordpress-global-styles",
      "wordpress-global-styles",
      "wordpress-block-library",
      "wordpress-block-library",
      "wordpress-custom-css",
      "wordpress-block-compatibility",
    ],
  );

  secondCleanup();
  cleanup();
  dom.window.close();
});

test("keeps the loaded prerendered WordPress style bundle authoritative during hydration", () => {
  const styles = {
    customCss: ".editor-rule{color:red}",
    fontFaceStyles: "",
    globalStyles: ":root :where(.wp-element-button){background:#32373c}",
    stylesheets: [
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/style.min.css?ver=7.0.2",
      "https://v3.superfunky.pro/wp-includes/css/dist/block-library/theme.min.css?ver=7.0.2",
    ],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  };
  const sourceHash = staticStyleSourceHash(styles);
  const dom = new JSDOM(
    `<html><head><style data-wordpress-static-style-source="${sourceHash}">body{color:inherit}</style></head><body></body></html>`,
  );
  Object.assign(globalThis, { document: dom.window.document });
  const staticStyleBundle = document.querySelector("[data-wordpress-static-style-source]");
  Object.defineProperty(staticStyleBundle, "sheet", { value: {} });

  const cleanup = mountPageStyles(styles, "https://v3.superfunky.pro/graphql");
  assert.equal(document.querySelectorAll('link[data-wordpress-page-style="wordpress-block-library"]').length, 0);
  assert.equal(document.querySelectorAll('style[data-wordpress-page-style="wordpress-global-styles"]').length, 0);
  assert.equal(document.querySelectorAll('style[data-wordpress-page-style="wordpress-custom-css"]').length, 0);
  assert.equal(document.querySelectorAll("[data-wordpress-page-style]").length, 0);

  cleanup();
  assert.ok(document.querySelector("style[data-wordpress-static-style-source]"));
  dom.window.close();
});

test("mounts runtime fallback styles when the prerendered stylesheet failed to load", () => {
  const styles = {
    customCss: ".editor-rule{color:red}",
    fontFaceStyles: "",
    globalStyles: ":root :where(.wp-element-button){background:#32373c}",
    stylesheets: [],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  };
  const sourceHash = staticStyleSourceHash(styles);
  const dom = new JSDOM(
    `<html><head><link rel="stylesheet" href="/assets/missing.css" data-wordpress-static-style-source="${sourceHash}"></head><body></body></html>`,
  );
  Object.assign(globalThis, { document: dom.window.document });

  const cleanup = mountPageStyles(styles, "https://v3.superfunky.pro/graphql");
  assert.ok(document.querySelector('style[data-wordpress-page-style="wordpress-global-styles"]'));
  assert.ok(document.querySelector('style[data-wordpress-page-style="wordpress-custom-css"]'));
  assert.ok(document.querySelector('style[data-wordpress-page-style="wordpress-block-compatibility"]'));
  assert.equal(document.querySelector("link[data-wordpress-static-style-source]"), null);

  cleanup();
  dom.window.close();
});

test("does not replace a loaded prerendered style bundle with runtime styles", () => {
  const styles = {
    customCss: ".new-rule{color:blue}",
    fontFaceStyles: "",
    globalStyles: "",
    stylesheets: [],
    colors: [],
    fontFamilies: [],
    fontSizes: [],
    gradients: [],
    spacingSizes: [],
    contentSize: "",
    wideSize: "",
  };
  const dom = new JSDOM(
    '<html><head><link rel="stylesheet" href="/assets/old.css" data-wordpress-static-style-source="stale"></head><body></body></html>',
  );
  Object.assign(globalThis, { document: dom.window.document });
  const staticStyleBundle = document.querySelector("link[data-wordpress-static-style-source]");
  Object.defineProperty(staticStyleBundle, "sheet", { value: {} });

  const cleanup = mountPageStyles(styles, "https://v3.superfunky.pro/graphql");
  assert.ok(document.querySelector("link[data-wordpress-static-style-source]"));
  assert.equal(document.querySelector('[data-wordpress-page-style]'), null);

  cleanup();
  dom.window.close();
});

test("mounts compatibility styles when optional CMS theme styles are unavailable", () => {
  const dom = new JSDOM("<html><head></head><body></body></html>");
  Object.assign(globalThis, { document: dom.window.document });

  const cleanup = mountPageStyles(undefined, "https://cms.example");
  assert.ok(document.querySelector('style[data-wordpress-page-style="wordpress-block-compatibility"]'));
  assert.equal(document.querySelector('style[data-wordpress-page-style="wordpress-font-faces"]'), null);
  assert.equal(document.querySelector('link[data-wordpress-page-style="wordpress-block-library"]'), null);

  cleanup();
  assert.equal(document.querySelector('[data-wordpress-page-style="wordpress-block-compatibility"]'), null);
  dom.window.close();
});
