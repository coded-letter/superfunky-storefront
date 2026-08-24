import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  findRenderableShortcodeMarkers,
  normalizeRenderedShortcodeOutput,
  normalizeSupportedShortcodes,
  recoverRawShortcodeAttributes,
  slotRenderableShortcodeMarkers,
} from "./shortcodeMarkup.ts";
import { resolveSliderContentType, resolveStaticSliderItems } from "./shortcodeSlider.ts";
import { buildShortcode } from "./shortcodeSyntax.ts";
import { resolveShortcodeCta } from "./shortcodeCta.ts";

const supported = ["hero", "funkycommerce_map", "funkycommerce_locations", "gml_map", "cart", "account"];

test("normalizes supported raw shortcode text without matching Tailwind arbitrary values", () => {
  const html = '<div class="min-h-[45vh] data-[active=true]:block"><p>[gml_map]</p></div>';
  const normalized = normalizeSupportedShortcodes(html, supported);
  assert.match(normalized, /data-funkycommerce-shortcode="gml_map"/);
  assert.match(normalized, /min-h-\[45vh\]/);
  assert.match(normalized, /data-\[active=true\]:block/);
});

test("normalizes the production map and locations shortcodes independently", () => {
  const normalized = normalizeSupportedShortcodes(
    '<p>[funkycommerce_map height="640"]</p><p>[funkycommerce_locations]</p>',
    supported,
  );
  assert.match(normalized, /data-funkycommerce-shortcode="funkycommerce_map" data-height="640"/);
  assert.match(normalized, /data-funkycommerce-shortcode="funkycommerce_locations"/);
  assert.doesNotMatch(normalized, /\[funkycommerce_(?:map|locations)/);
});

test("preserves unknown and documentation shortcode examples", () => {
  const html = "<p>[unknown foo=\"bar\"]</p><pre><code>[hero title=\"Example\"]</code></pre>";
  assert.equal(normalizeSupportedShortcodes(html, supported), html);
});

test("recovers React markers from native shortcode output returned by a non-headless backend", () => {
  const dom = new JSDOM();
  Object.assign(globalThis, { DOMParser: dom.window.DOMParser });
  const html = [
    '<section class="funkycommerce-native funkycommerce-native-categories"><div>Server categories</div></section>',
    '<div class="funkycommerce-native funkycommerce-native-slider"><ul><li>Server product</li></ul></div>',
    '<section class="funkycommerce-native funkycommerce-native-hero"><div>Server hero</div></section>',
    '<section class="funkycommerce-native funkycommerce-native-grid"><div>Server grid</div></section>',
  ].join("");
  const normalized = normalizeRenderedShortcodeOutput(
    html,
    ["categories", "slider", "hero", "grid"],
    [
      '[categories type="product"]',
      '[slider type="product"]',
      '[hero title="Free shipping"]',
      '[grid type="product"]',
    ],
  );

  assert.deepEqual(
    findRenderableShortcodeMarkers(normalized).map(({ name }) => name),
    ["categories", "slider", "hero", "grid"],
  );
  assert.doesNotMatch(normalized, /Server categories|Server product|Server hero|Server grid/);
  dom.window.close();
});

test("matches distinct carousel and prefixed map output without consuming nested native modules", () => {
  const dom = new JSDOM();
  Object.assign(globalThis, { DOMParser: dom.window.DOMParser });
  const html = [
    '<section class="funkycommerce-native funkycommerce-native-related-sections"><section class="funkycommerce-native funkycommerce-native-grid">Nested grid</section></section>',
    '<section class="funkycommerce-native funkycommerce-native-carousel">Carousel</section>',
    '<div class="funkycommerce-native funkycommerce-native-funkycommerce-map">Map</div>',
    '<section class="funkycommerce-native funkycommerce-native-grid">Top-level grid</section>',
  ].join("");
  const normalized = normalizeRenderedShortcodeOutput(
    html,
    ["related-sections", "carousel", "funkycommerce_map", "grid"],
    ["[related-sections]", "[carousel]", "[funkycommerce_map]", "[grid]"],
  );

  assert.deepEqual(
    findRenderableShortcodeMarkers(normalized).map(({ name }) => name),
    ["related-sections", "carousel", "funkycommerce_map", "grid"],
  );
  assert.doesNotMatch(normalized, /Nested grid|Carousel|Map|Top-level grid/);
  dom.window.close();
});

test("normalizes aliases and validates quoted and bare attributes", () => {
  const normalized = normalizeSupportedShortcodes(
    '<p>[cart layout="classic" summary_position=sticky]</p>',
    supported,
  );
  assert.deepEqual(findRenderableShortcodeMarkers(normalized), [{
    attributes: { layout: "classic", "summary-position": "sticky" },
    end: normalized.indexOf("</div>") + 6,
    name: "cart",
    start: normalized.indexOf("<div"),
  }]);
});

test("serializes shortcode arrays as plain comma-separated values", () => {
  assert.equal(
    buildShortcode("slider", {
      type: "cinematic",
      bgimgs: ["hero-1", "hero-2"],
      h1: ["First slide", "Second slide"],
    }),
    '[slider type="cinematic" bgimgs="hero-1,hero-2" h1="First slide,Second slide"]',
  );
});

test("resolves cinematic sliders to static slide data", () => {
  assert.equal(resolveSliderContentType("cinematic"), "campaign");
  assert.deepEqual(resolveStaticSliderItems({
    type: "cinematic",
    bgimgs: "hero-1,hero-2",
    h1: "New season, new silhouettes, Stories from the studio",
    p: "SS26 drop — apparel, footwear, and accessories built for people who move differently., Behind-the-scenes journal entries, style guides, and care notes from the team.",
    pill: "New season · SS26,The journal",
  }), [
    {
      title: "New season, new silhouettes",
      description: "SS26 drop — apparel, footwear, and accessories built for people who move differently.",
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
      kicker: "New season · SS26",
    },
    {
      title: "Stories from the studio",
      description: "Behind-the-scenes journal entries, style guides, and care notes from the team.",
      image: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
      kicker: "The journal",
    },
  ]);
});

test("restores raw editor attributes over backend shortcode defaults", () => {
  const html = [
    '<div data-funkycommerce-shortcode="slider" data-type="product" data-title=""></div>',
    '<div data-funkycommerce-shortcode="hero" data-title="Storefront hero"></div>',
  ].join("");
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, [
    '[slider type="cinematic" h1="First, Second"]',
    '[hero h1="Free shipping" primary_cta_target="_blank"]',
  ]);
  assert.deepEqual(recovered[0]?.attributes, { type: "cinematic", title: "", h1: "First, Second" });
  assert.deepEqual(recovered[1]?.attributes, {
    title: "Storefront hero",
    h1: "Free shipping",
    "primary-cta-target": "_blank",
  });
});

test("supports safe new-tab CTAs for heroes and cinematic sliders", () => {
  assert.deepEqual(resolveShortcodeCta({
    cta1: "Shop now|/shop|_blank|noreferrer",
  }, "primary"), {
    label: "Shop now",
    href: "/shop",
    target: "_blank",
    rel: "noreferrer noopener",
  });
  assert.deepEqual(resolveShortcodeCta({
    "secondary-cta-label": "Journal",
    "secondary-cta-href": "/blog",
    "secondary-cta-target": "new",
  }, "secondary"), {
    label: "Journal",
    href: "/blog",
    target: "_blank",
    rel: "noopener",
  });
});

test("preserves strip hero shorthand attributes through normalization", () => {
  const normalized = normalizeSupportedShortcodes(
    '[hero variant="strip" pill="Limited time" h1="Free shipping over $75" p="Ends Sunday — no code needed at checkout." cta1="Shop now|/shop"]',
    supported,
  );
  assert.deepEqual(findRenderableShortcodeMarkers(normalized)[0]?.attributes, {
    variant: "strip",
    pill: "Limited time",
    h1: "Free shipping over $75",
    p: "Ends Sunday — no code needed at checkout.",
    cta1: "Shop now|/shop",
  });
});

test("finds only executable markers, not markers inside code or script", () => {
  const html = [
    '<code><div data-funkycommerce-shortcode="hero"></div></code>',
    '<script>const example = `<div data-funkycommerce-shortcode="hero"></div>`;</script>',
    '<div data-funkycommerce-component="account" data-default-tab="orders"></div>',
  ].join("");
  const markers = findRenderableShortcodeMarkers(html);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].name, "account");
  assert.deepEqual(markers[0].attributes, { "default-tab": "orders" });
});

test("slots shortcode renderers without removing them from parent WordPress Columns", () => {
  const html = [
    '<div class="wp-block-columns">',
    '<div class="wp-block-column"><p>Keep this column content.</p>',
    '<div data-funkycommerce-shortcode="unsubscribe-form"></div>',
    "</div>",
    '<div class="wp-block-column"><p>Second column.</p></div>',
    "</div>",
  ].join("");
  const slotted = slotRenderableShortcodeMarkers(html);

  assert.equal(slotted.markers.length, 1);
  assert.equal(slotted.markers[0].name, "unsubscribe-form");
  assert.match(
    slotted.html,
    /<div class="wp-block-column"><p>Keep this column content\.<\/p><div data-funkycommerce-shortcode="unsubscribe-form" data-funkycommerce-render-slot="shortcode-0"><\/div><\/div>/,
  );
});

test("marks full-width slots for every truthy shortcode attribute", () => {
  for (const value of ["1", "true", "yes", "on", "True"]) {
    const slotted = slotRenderableShortcodeMarkers(
      '<div data-funkycommerce-shortcode="hero"></div>',
      [`[hero fullwidth="${value}"]`],
    );

    assert.match(slotted.html, /data-funkycommerce-fullwidth="true"/);
  }
});

test("normalizes every cart and checkout alias while preserving surrounding paragraphs", () => {
  const aliases = [
    "cart",
    "funkycommerce_cart",
    "woocommerce_cart",
    "checkout",
    "funkycommerce_checkout",
    "woocommerce_checkout",
  ];
  for (const alias of aliases) {
    const normalized = normalizeSupportedShortcodes(
      `<p>Before</p>[${alias}]<p>After</p>`,
      aliases,
    );
    assert.match(normalized, /<p>Before<\/p>/);
    assert.match(normalized, /<p>After<\/p>/);
    assert.equal(findRenderableShortcodeMarkers(normalized)[0]?.name, alias);
    assert.doesNotMatch(normalized, new RegExp(`\\[${alias}\\]`));
  }
});

test("recovers missing collection offsets from raw shortcode references", () => {
  const html = '<div data-funkycommerce-shortcode="slider"></div>';
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, ['[slider offset="6"]']);
  assert.equal(recovered[0]?.attributes.offset, "6");
});

test("keeps existing marker offsets over raw references", () => {
  const html = '<div data-funkycommerce-shortcode="slider" data-offset="9"></div>';
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, ['[slider offset="6"]']);
  assert.equal(recovered[0]?.attributes.offset, "9");
});

test("pairs mixed shortcode offsets by canonical name and occurrence order", () => {
  const html = [
    '<div data-funkycommerce-shortcode="slider"></div>',
    '<div data-funkycommerce-shortcode="grid"></div>',
    '<div data-funkycommerce-shortcode="slider"></div>',
  ].join("");
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, [
    '[SLIDER offset="2"]',
    '[grid offset="4"]',
    '[slider offset="6"]',
  ]);
  assert.equal(recovered[0]?.attributes.offset, "2");
  assert.equal(recovered[1]?.attributes.offset, "4");
  assert.equal(recovered[2]?.attributes.offset, "6");
});

test("ignores invalid raw offsets and clamps negative or out-of-range values", () => {
  const html = [
    '<div data-funkycommerce-shortcode="slider"></div>',
    '<div data-funkycommerce-shortcode="slider"></div>',
    '<div data-funkycommerce-shortcode="slider"></div>',
  ].join("");
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, [
    '[slider offset="invalid"]',
    '[slider offset="-3"]',
    '[slider offset="2000000"]',
  ]);
  assert.equal(recovered[0]?.attributes.offset, undefined);
  assert.equal(recovered[1]?.attributes.offset, "0");
  assert.equal(recovered[2]?.attributes.offset, "1000000");
});

test("recovers and clamps sticky-posts offsets for both the canonical name and its neutral alias", () => {
  const html = [
    '<div data-funkycommerce-shortcode="sticky-posts"></div>',
    '<div data-funkycommerce-shortcode="sticky_posts"></div>',
  ].join("");
  const markers = findRenderableShortcodeMarkers(html);
  const recovered = recoverRawShortcodeAttributes(markers, [
    '[sticky-posts offset="3"]',
    '[sticky_posts offset="-5"]',
  ]);
  assert.equal(recovered[0]?.attributes.offset, "3");
  assert.equal(recovered[1]?.attributes.offset, "0");
});
