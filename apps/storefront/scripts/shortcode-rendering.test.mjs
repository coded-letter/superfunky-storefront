import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLICATION_SHORTCODE_NAMES,
  CONTENT_SHORTCODE_NAMES,
  SHORTCODE_ALIASES,
  SUPPORTED_SHORTCODE_NAMES,
  canonicalShortcodeName,
} from "../src/lib/shortcodeRegistry.mjs";
import { normalizeStaticShortcodes } from "../src/lib/staticShortcodeMarkup.mjs";

const appRoot = new URL("../", import.meta.url);

test("prerender and hydration share one bounded shortcode registry", async () => {
  const [applications, contentRenderers] = await Promise.all([
    readFile(new URL("src/components/applicationShortcodeRenderers.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
  ]);
  assert.equal(new Set(SUPPORTED_SHORTCODE_NAMES).size, SUPPORTED_SHORTCODE_NAMES.length);
  assert.match(applications, /APPLICATION_SHORTCODE_NAMES/);
  assert.match(contentRenderers, /CONTENT_SHORTCODE_NAMES/);
  for (const [alias, target] of Object.entries(SHORTCODE_ALIASES)) {
    assert.equal(canonicalShortcodeName(alias), target);
    assert.ok(APPLICATION_SHORTCODE_NAMES.includes(target));
  }
  assert.ok(CONTENT_SHORTCODE_NAMES.length > 0);
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("funkycommerce_map"));
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("funkycommerce_locations"));
});

test("production map shortcodes receive the correct static fallback sizes", () => {
  const output = normalizeStaticShortcodes(
    "[funkycommerce_map][funkycommerce_locations]",
    { placeholders: true },
  );
  assert.match(output, /shortcode-prerender-fallback--map[^>]+data-prerendered-shortcode="funkycommerce_map"/);
  assert.match(output, /shortcode-prerender-fallback--content[^>]+data-prerendered-shortcode="funkycommerce_locations"/);
});

test("hero shortcodes render semantic first-paint content instead of an empty loading region", () => {
  const output = normalizeStaticShortcodes(
    '[hero variant="fullbleed" kicker="Proof" title="Build & ship" description="Static first." image="https://example.com/hero.jpg?w=1280&quality=75" primary_cta_label="Explore" primary_cta_href="/docs?from=hero&mode=fast" height="75vh"]',
    { placeholders: true },
  );
  assert.match(output, /shortcode-prerender-hero--fullbleed/);
  assert.match(output, /shortcode-prerender-hero__container/);
  assert.match(output, /<h1 class="shortcode-prerender-hero__title">Build &amp; ship<\/h1>/);
  assert.match(output, /src="https:\/\/example\.com\/hero\.jpg\?w=1280&amp;quality=75"/);
  assert.match(output, /href="\/docs\?from=hero&amp;mode=fast"/);
  assert.doesNotMatch(output, /&amp;amp;/);
  assert.match(output, /data-prerender-min-height="75vh"/);
  assert.doesNotMatch(output, /role="status"|Loading hero/);
});

test("video heroes render a static poster and activate on demand", () => {
  const output = normalizeStaticShortcodes(
    '[video-hero title="Play the story" src="https://example.com/story.mp4" poster="https://example.com/poster.jpg" height="70vh"]',
    { placeholders: true },
  );
  assert.match(output, /data-prerendered-shortcode="video-hero"/);
  assert.match(output, /data-prerender-video-poster="true"/);
  assert.match(output, /data-storefront-control="video-hero-play"/);
  assert.match(output, /data-storefront-activate/);
  assert.match(output, /src="https:\/\/example\.com\/poster\.jpg"/);
  assert.match(output, />Play the story<\/h1>/);
  assert.doesNotMatch(output, /role="status"|Loading video hero/);
});

test("posterless video heroes preserve static paint until their Play control activates React", () => {
  const output = normalizeStaticShortcodes(
    '[video-hero title="Play the story" src="https://example.com/story.mp4"]',
    { placeholders: true },
  );

  assert.match(output, /data-prerender-video-poster="false"/);
  assert.match(output, /data-storefront-activate-only/);
  assert.match(output, /aria-label="Play background video"/);
});

test("video heroes without a supported source do not create unmatched static controls", () => {
  const output = normalizeStaticShortcodes(
    '[video-hero title="Unavailable story" src="javascript:alert(1)"]',
    { placeholders: true },
  );

  assert.doesNotMatch(output, /data-prerender-video-poster/);
  assert.doesNotMatch(output, /data-storefront-control="video-hero-play"/);
});

test("static hero markup rejects executable URLs and unsafe CSS lengths", () => {
  const output = normalizeStaticShortcodes(
    '[hero title="Safe" image="javascript:alert(1)" primary_cta_label="Bad" primary_cta_href="javascript:alert(1)" height="calc(100vh)"]',
    { placeholders: true },
  );
  assert.doesNotMatch(output, /<img|<a|style=|data-prerender-min-height/);
  assert.match(output, />Safe<\/h1>/);
});

test("headless page rendering transports WordPress block-level custom CSS", async () => {
  const [themeFunctions, page, specialPage, post] = await Promise.all([
    readFile(new URL("../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/functions.php", appRoot), "utf8"),
    readFile(new URL("src/pages/PageMockupPage.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/CmsPageContent.tsx", appRoot), "utf8"),
    readFile(new URL("src/pages/PostMockupPage.tsx", appRoot), "utf8"),
  ]);

  assert.match(themeFunctions, /get_data\(\s*'wp-block-custom-css',\s*'after'\s*\)/);
  assert.match(themeFunctions, /wp-custom-css-\[a-z0-9-\]/);
  assert.match(themeFunctions, /data-wp-block-supports="custom-css"/);
  assert.match(themeFunctions, /funkycommerce_get_rendered_block_custom_css\(\s*\$content\s*\)/);
  for (const wrapper of [page, specialPage, post]) assert.doesNotMatch(wrapper, /\[&_/);
});

test("auth shortcode supports a combined view switch and redirects active sessions", async () => {
  const [renderers, authPage, auth, themeFunctions] = await Promise.all([
    readFile(new URL("src/components/applicationShortcodeRenderers.tsx", appRoot), "utf8"),
    readFile(new URL("src/pages/AuthMockupPage.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/auth.ts", appRoot), "utf8"),
    readFile(new URL("../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/functions.php", appRoot), "utf8"),
  ]);

  assert.match(renderers, /\["login", "register", "forgot-password", "combined"\]/);
  assert.match(authPage, /mode === "combined"/);
  assert.match(authPage, /label=\{t\("auth\.mode_selector"\)\}[\s\S]*hideLabel/);
  assert.doesNotMatch(authPage, /Authentication view|>Superfunky</);
  assert.match(authPage, /config\["default-mode"\]/);
  assert.match(authPage, /return <Navigate to=\{authRef \|\| accountPath\} replace \/>/);
  assert.match(themeFunctions, /'mode'\s*=>\s*array\(\s*'default'\s*=>\s*'login',\s*'enum'\s*=>\s*array\(\s*'login',\s*'register',\s*'forgot-password',\s*'combined'\s*\)\s*\)/);
  assert.match(themeFunctions, /'default_mode'\s*=>\s*array\(\s*'default'\s*=>\s*'login',\s*'enum'\s*=>\s*array\(\s*'login',\s*'register',\s*'forgot-password'\s*\)\s*\)/);
  assert.match(auth, /export function useIsUserLoggedIn\(\)/);
  assert.match(auth, /useBackgroundAuthSnapshot\(\(auth\) => Boolean\(auth\?\.authToken\), false\)/);
});

test("fullbleed hero fills its height and aligns copy to the theme gutter", async () => {
  const [hero, styles] = await Promise.all([
    readFile(new URL("src/components/HeroMock.tsx", appRoot), "utf8"),
    readFile(new URL("src/styles.css", appRoot), "utf8"),
  ]);
  const fullbleed = hero.slice(
    hero.indexOf('if (variant === "fullbleed")'),
    hero.indexOf('if (variant === "split")'),
  );

  assert.match(fullbleed, /flex items-center overflow-hidden shadow-soft-lg/);
  // Only a viewport breakout (`fullWidth`) should flatten corners to zero — a
  // constrained fullbleed hero (still boxed inside the page column) follows the
  // same theme radius as every other hero variant.
  assert.match(fullbleed, /fullWidth \? breakoutClassName : ""/);
  assert.match(hero, /borderRadius: fullWidth \? 0 : "var\(--theme-radius\)"/);
  assert.match(fullbleed, /absolute inset-0 block !h-full !w-full max-w-none !rounded-none object-cover object-center/);
  assert.match(fullbleed, /mx-auto w-full px-4 sm:px-6 lg:px-8/);
  assert.match(fullbleed, /relative grid max-w-xl gap-4 py-8 sm:py-12/);
  assert.doesNotMatch(fullbleed, /line-clamp-3 max-w-lg/);
  assert.doesNotMatch(fullbleed, /items-end|gap-4 p-8 sm:p-12/);
  assert.match(styles, /\.shortcode-prerender-hero--fullbleed \.shortcode-prerender-hero__container \{[\s\S]*max-width: 1280px;[\s\S]*padding-inline: 1rem;/);
  assert.match(styles, /\.shortcode-prerender-hero--fullbleed \.shortcode-prerender-hero__inner \{[\s\S]*max-width: 36rem;[\s\S]*padding: 2rem 0;/);
  assert.match(styles, /\.shortcode-prerender-hero--fullbleed \.shortcode-prerender-hero__title \{[\s\S]*font-size: 1\.875rem/);
  assert.match(styles, /@media \(min-width: 640px\) \{[\s\S]*font-size: 3rem/);
});

test("hero CTAs support validated target and rel attributes", async () => {
  const [hero, shortcodes, shortcodeCta] = await Promise.all([
    readFile(new URL("src/components/HeroMock.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/shortcodeCta.ts", appRoot), "utf8"),
  ]);

  assert.match(shortcodes, /resolveShortcodeCta\(attributes, "primary"\)/);
  assert.match(shortcodeCta, /\$\{position\}-cta-target/);
  assert.match(shortcodeCta, /\$\{position\}-cta-rel/);
  assert.match(shortcodeCta, /target === "_blank"[\s\S]*relTokens\.push\("noopener"\)/);
  assert.match(hero, /target=\{cta\.target\}/);
  assert.match(hero, /rel=\{cta\.rel\}/);
});

test("hero supports compact editor aliases and strip background images", async () => {
  const [hero, shortcodes] = await Promise.all([
    readFile(new URL("src/components/HeroMock.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
  ]);
  const strip = hero.slice(hero.indexOf('// variant === "strip"'));

  assert.match(shortcodes, /resolveShortcodeCta\(attributes, "primary"\)/);
  assert.match(shortcodes, /kicker=\{attributes\.pill \|\| attributes\.kicker/);
  assert.match(shortcodes, /title=\{attributes\.h1 \|\| attributes\.h2 \|\| attributes\.title/);
  assert.match(shortcodes, /attributes\.h2 && !attributes\.h1 \? "h2" : "h1"/);
  assert.match(shortcodes, /"product-tags": \(attributes\) => <ProductTagsShortcode/);
  assert.match(shortcodes, /product_tags: \(attributes\) => <ProductTagsShortcode/);
  assert.match(shortcodes, /oneOf\(attributes\.type, \["post", "product"\], "post"\)/);
  assert.match(shortcodes, /oneOf<SocialFeedLayout>\(attributes\.layout/);
  assert.match(shortcodes, /toInteger\(attributes\["page-size"\]/);
  assert.match(shortcodes, /description=\{attributes\.p \|\| attributes\.description/);
  assert.match(shortcodes, /resolveShortcodeImage\(attributes\.bgimg \|\| attributes\["bg-image"\] \|\| attributes\.image \|\| attributes\["background-image"\]/);
  assert.match(strip, /className="absolute inset-0 block !h-full !w-full max-w-none object-cover object-center"/);
  assert.match(strip, /bg-zinc-950\/65/);
});

test("hero background media always fills and centers its mobile frame", async () => {
  const [hero, styles] = await Promise.all([
    readFile(new URL("src/components/HeroMock.tsx", appRoot), "utf8"),
    readFile(new URL("src/styles.css", appRoot), "utf8"),
  ]);

  assert.match(hero, /pointer-events-none absolute inset-0 block !h-full !w-full max-w-none scale-105 object-cover object-center/);
  assert.match(hero, /block !h-full !w-full max-w-none object-cover object-center/);
  assert.match(styles, /\.shortcode-prerender-hero__image \{[\s\S]*object-fit: cover !important;[\s\S]*object-position: center !important;/);
});

test("hero calls to action follow brand radius and stay above mobile video controls", async () => {
  const [hero, videoHero, productCard] = await Promise.all([
    readFile(new URL("src/components/HeroMock.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/VideoHero.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/catalog/ProductCard.tsx", appRoot), "utf8"),
  ]);
  assert.doesNotMatch(hero, /HeroCtaLink[\s\S]{0,180}rounded-full/);
  assert.match(videoHero, /relative z-30 flex flex-wrap gap-3/);
  assert.match(videoHero, /primaryCta[\s\S]{0,180}rounded-control/);
  assert.match(productCard, /product\.cta\.learn_more[\s\S]*?font-display text-xs font-semibold/);
});

test("slider product cards keep equal heights and crop media independently of source aspect", async () => {
  const [slider, productCard] = await Promise.all([
    readFile(new URL("src/components/SliderMock.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/catalog/ProductCard.tsx", appRoot), "utf8"),
  ]);

  assert.match(slider, /className="min-w-0 w-full shrink-0 self-stretch snap-start snap-always"/);
  assert.match(slider, /className=\{`grid h-full min-w-0/);
  assert.match(productCard, /className="relative block h-full w-full overflow-hidden rounded-\[inherit\] no-underline"/);
  assert.match(productCard, /absolute inset-0 block !h-full !w-full max-w-none/);
  assert.match(productCard, /imageSizingClass[\s\S]*"object-cover"/);
  assert.match(productCard, /line-clamp-2 h-\[3\.25rem\][\s\S]*leading-6/);
});

test("full-width shortcode render slots escape the storefront content column", async () => {
  const styles = await readFile(new URL("src/styles.css", appRoot), "utf8");

  assert.match(
    styles,
    /\[data-funkycommerce-render-slot\]\[data-funkycommerce-fullwidth="true"\] \{[\s\S]*inline-size: 100vw !important;[\s\S]*margin-inline: calc\(50% - 50vw\) !important;[\s\S]*max-inline-size: none !important;/,
  );
  assert.match(
    styles,
    /\[data-funkycommerce-render-slot\]\[data-funkycommerce-fullwidth="true"\][\s\S]*> \[data-rendered-cms-shortcode\] \{[\s\S]*inline-size: 100%;[\s\S]*max-inline-size: none;/,
  );
});

test("campaign and cinematic sliders accept pipe-safe text arrays and optional CTAs", async () => {
  const [shortcodes, sliderHelpers, shortcodeCta, themeFunctions] = await Promise.all([
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/shortcodeSlider.ts", appRoot), "utf8"),
    readFile(new URL("src/lib/shortcodeCta.ts", appRoot), "utf8"),
    readFile(new URL("../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/functions.php", appRoot), "utf8"),
  ]);

  assert.match(shortcodes, /resolveSliderContentType\(attributes\.type\)/);
  assert.match(shortcodes, /resolveStaticSliderItems\(attributes\)/);
  assert.match(shortcodes, /resolveShortcodeCta\(attributes, "primary"\)/);
  assert.match(sliderHelpers, /value\.includes\("\|"\) \? "\|" : ","/);
  assert.match(sliderHelpers, /attributes\.h1 \|\| attributes\.titles/);
  assert.match(sliderHelpers, /attributes\.p \|\| attributes\.descriptions/);
  assert.match(shortcodeCta, /attributes\[position === "primary" \? "cta1" : "cta2"\]/);
  assert.match(shortcodeCta, /attributes\[\`\$\{position\}-cta-target\`\]/);
  assert.match(themeFunctions, /'type'\s*=>\s*array\(\s*'default'\s*=>\s*'product',\s*'enum'\s*=>\s*array\(\s*'campaign',\s*'cinematic',\s*'product',\s*'post'\s*\)\s*\)/);
  assert.match(themeFunctions, /'bgimgs'\s*=>\s*array\(\s*'default'\s*=>\s*''\s*\)/);
  assert.match(themeFunctions, /'primary_cta_label'\s*=>\s*array\(\s*'default'\s*=>\s*''\s*\)/);
  assert.match(themeFunctions, /'secondary_cta_href'\s*=>\s*array\(\s*'default'\s*=>\s*'',\s*'type'\s*=>\s*'url-path'\s*\)/);
});

test("product media keeps its clipping radius while transformed", async () => {
  const productCard = await readFile(new URL("../../packages/ui/src/catalog/ProductCard.tsx", appRoot), "utf8");

  assert.match(productCard, /isolate overflow-hidden \[transform:translateZ\(0\)\]/);
  assert.match(productCard, /overflow-hidden rounded-\[inherit\] no-underline/);
  assert.match(productCard, /absolute inset-0 block !h-full !w-full max-w-none rounded-\[inherit\]/);
  assert.doesNotMatch(productCard, /group-hover\/media:scale-105/);
});

test("shared product, post, and social grids filter before pagination", async () => {
  const [products, posts, social, shortcodes, commerce] = await Promise.all([
    readFile(new URL("../../packages/ui/src/catalog/PaginableProductGrid.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/blog/PaginablePostGrid.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/social/SocialFeedGrid.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/commerce.ts", appRoot), "utf8"),
  ]);

  assert.match(products, /const filteredProducts = useMemo/);
  assert.match(products, /filteredProducts\.slice\(start, end\)/);
  assert.match(products, /value=\{sortBy\} onChange=\{\(event\) => setSortBy/);
  assert.match(posts, /const filteredPosts = useMemo/);
  assert.match(posts, /filteredPosts\.slice\(start, end\)/);
  assert.match(social, /const filteredPosts = useMemo/);
  assert.match(social, /activeTagFilter[\s\S]*author[\s\S]*normalizedQuery/);
  assert.match(shortcodes, /function filterProducts\(/);
  assert.match(shortcodes, /include\.includes\(product\.slug\)/);
  assert.match(shortcodes, /matchesShortcodeValues\(product\.tagSlugs \|\| \[\], tag\)/);
  assert.match(shortcodes, /matchesShortcodeValues\(\[\.\.\.\(product\.categorySlugs \|\| \[\]\), product\.category\], category\)/);
  assert.match(commerce, /const PRODUCT_LIST_CARD_FIELDS[\s\S]*productTags \{/);
});

test("shortcode grid and post slider media fill frames without distorting source aspects", async () => {
  const [productCard, productGrid, postCard, postGrid, shortcodes] = await Promise.all([
    readFile(new URL("../../packages/ui/src/catalog/ProductCard.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/catalog/PaginableProductGrid.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/blog/PostCard.tsx", appRoot), "utf8"),
    readFile(new URL("../../packages/ui/src/blog/PaginablePostGrid.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
  ]);

  assert.match(productCard, /imageSizingClass = isExpandable \? "object-cover p-4 pt-12" : "object-cover"/);
  assert.equal((postCard.match(/absolute inset-0 block !h-full !w-full max-w-none/g) || []).length, 3);
  assert.equal((postCard.match(/object-cover/g) || []).length, 3);
  assert.doesNotMatch([productCard, productGrid, postCard, postGrid, shortcodes].join("\n"), /object-fill|imageFit|image-fit/);
});

test("shortcode collections apply bounded offsets before limits and pagination", async () => {
  const [shortcodes, collections] = await Promise.all([
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/shortcodeCollections.ts", appRoot), "utf8"),
  ]);

  assert.match(shortcodes, /withCollectionOffset\(filterPosts\(blog\?\.posts \|\| \[\], attributes\), attributes\.offset, limit\)/);
  assert.match(shortcodes, /withCollectionOffset\(filterPosts\(sourcePosts, attributes\), attributes\.offset\)/);
  assert.match(shortcodes, /const posts = withCollectionOffset\(\s*\(data\?\.posts \|\| \[\]\)\.filter/);
  assert.match(shortcodes, /const products = withCollectionOffset\(filterProducts/);
  assert.match(collections, /Math\.min\(MAX_COLLECTION_OFFSET, Math\.max\(0, parsed\)\)/);
  assert.match(collections, /items\.slice\(offset, limit === undefined \? undefined : offset \+ limit\)/);
});

test("cart and checkout aliases preserve surrounding CMS paragraphs without raw leakage", () => {
  const aliases = [
    "cart",
    "funkycommerce_cart",
    "woocommerce_cart",
    "checkout",
    "funkycommerce_checkout",
    "woocommerce_checkout",
  ];
  for (const alias of aliases) {
    const output = normalizeStaticShortcodes(
      `<p>Before ${alias}</p>[${alias} summary_position="sticky"]<p>After ${alias}</p>`,
      { placeholders: true },
    );
    assert.match(output, new RegExp(`<p>Before ${alias}</p>`));
    assert.match(output, new RegExp(`<p>After ${alias}</p>`));
    assert.match(output, new RegExp(`data-funkycommerce-shortcode="${alias}"`));
    assert.match(output, new RegExp(`data-prerendered-shortcode="${alias}"`));
    assert.doesNotMatch(output, new RegExp(`\\[${alias}(?:\\s|\\])`));
  }
});

test("live-style component markers receive deterministic prerender fallbacks", () => {
  const output = normalizeStaticShortcodes(
    '<p>Before</p><div class="funkycommerce-headless-component" data-funkycommerce-component="checkout" data-mode="physical"></div><p>After</p>',
    { placeholders: true },
  );
  assert.match(output, /<p>Before<\/p>/);
  assert.match(output, /data-prerendered-shortcode="checkout"/);
  assert.match(output, /<p>After<\/p>/);
});

test("unknown shortcodes remain visible and protected examples remain inert", () => {
  const input = '<p>[unknown value="visible"]</p><code>[cart]</code>';
  assert.equal(normalizeStaticShortcodes(input, { placeholders: true }), input);
});

test("CMS utility routes use ordinary shortcode-composed pages under commerce providers", async () => {
  const [app, contentRoute, pages, paths, prerender] = await Promise.all([
    readFile(new URL("src/App.tsx", appRoot), "utf8"),
    readFile(new URL("src/pages/ContentNodeRoute.tsx", appRoot), "utf8"),
    readFile(new URL("src/lib/pages.ts", appRoot), "utf8"),
    readFile(new URL("src/lib/storefrontPaths.ts", appRoot), "utf8"),
    readFile(new URL("scripts/prerender.mjs", appRoot), "utf8"),
  ]);
  assert.match(app, /function RouteDataProviders[\s\S]*CommerceDataProvider[\s\S]*<Routes>/);
  assert.match(app, /routeKey="cart"/);
  assert.match(app, /routeKey="checkout"/);
  assert.match(contentRoute, /matchStorefrontRoute[\s\S]*PageMockupPage/);
  assert.doesNotMatch(pages, /funkycommerceSpecialPage/);
  assert.match(pages, /requestGraphqlWithCompatibility/);
  assert.match(paths, /pages\(where: \{ status: PUBLISH \}, first: 100, after: \$after\)/);
  assert.match(prerender, /type === "Page"[\s\S]*route\.cmsContent/);
  assert.doesNotMatch(prerender, /funkycommerceSpecialPage/);
});

test("sticky-posts registers its canonical name and neutral alias end-to-end", async () => {
  const [themeFunctions, contentRenderers, libraryPage] = await Promise.all([
    readFile(new URL("../../../backend/apps/wp-instance/wp-content/themes/funkycommerce-headless/functions.php", appRoot), "utf8"),
    readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8"),
    readFile(new URL("src/pages/ShortcodeLibraryMockupPage.tsx", appRoot), "utf8"),
  ]);

  // Registry: canonical + neutral alias both recognized, and neither collides with an
  // application shortcode or an existing alias target.
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("sticky-posts"));
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("sticky_posts"));
  assert.ok(SUPPORTED_SHORTCODE_NAMES.includes("sticky-posts"));
  assert.ok(SUPPORTED_SHORTCODE_NAMES.includes("sticky_posts"));
  assert.equal(canonicalShortcodeName("sticky-posts"), "sticky-posts");
  assert.equal(canonicalShortcodeName("sticky_posts"), "sticky_posts");

  // Backend schema/marker validation: both tags are registered content shortcodes and
  // share one validated schema (published/sticky/language filtering happens in the
  // GraphQL query itself, not in this marker), covering the layout/card/columns/limit
  // contract the React renderer expects.
  assert.match(themeFunctions, /'sticky-posts',\s*\n\s*'sticky_posts',/);
  assert.match(themeFunctions, /\$sticky_posts_schema\s*=\s*array\(/);
  assert.match(themeFunctions, /'layout'\s*=>\s*array\(\s*'default'\s*=>\s*'grid',\s*'enum'\s*=>\s*array\(\s*'grid',\s*'carousel',\s*'compact-list'\s*\)/);
  assert.match(themeFunctions, /'sticky-posts'\s*=>\s*\$sticky_posts_schema/);
  assert.match(themeFunctions, /'sticky_posts'\s*=>\s*\$sticky_posts_schema/);

  // Frontend renderer: both names resolve to the same shared-card renderer.
  assert.match(contentRenderers, /"sticky-posts":\s*\(attributes\)\s*=>\s*<StickyPostsShortcode/);
  assert.match(contentRenderers, /sticky_posts:\s*\(attributes\)\s*=>\s*<StickyPostsShortcode/);
  assert.match(contentRenderers, /function StickyPostsShortcode/);
  assert.match(contentRenderers, /useStickyPostsData/);

  // Library documentation references the canonical name and calls out the alias.
  assert.match(libraryPage, /name="sticky-posts"/);
  assert.match(libraryPage, /sticky_posts/);
});

test("sticky-posts shortcode markers normalize and recover collection offsets like other collection shortcodes", async () => {
  const canonical = normalizeStaticShortcodes('[sticky-posts layout="carousel" columns="4"]', { placeholders: true });
  assert.match(canonical, /data-funkycommerce-shortcode="sticky-posts"/);
  assert.match(canonical, /data-layout="carousel"/);
  assert.match(canonical, /data-columns="4"/);
  assert.match(canonical, /shortcode-prerender-fallback--content[^>]+data-prerendered-shortcode="sticky-posts"/);

  const alias = normalizeStaticShortcodes('[sticky_posts layout="grid"]', { placeholders: true });
  assert.match(alias, /data-funkycommerce-shortcode="sticky_posts"/);
  assert.match(alias, /data-layout="grid"/);
});

test("[community-feed] wires the community post like mutation into its SocialFeedGrid", async () => {
  const contentRenderers = await readFile(new URL("src/components/wordpressShortcodes.tsx", appRoot), "utf8");
  // Every heart button in the main community grid must actually call the like
  // mutation (previously it was a decorative count with no click handler at all).
  assert.match(contentRenderers, /import \{ toggleCommunityPostLike, type CommunityPostData \} from "\.\.\/lib\/community";/);
  assert.match(
    contentRenderers,
    /function CommunityFeedShortcode[\s\S]{0,3000}onToggleLike=\{\(post\) => toggleCommunityPostLike\(Number\(post\.id\)\)\}/,
  );
});
