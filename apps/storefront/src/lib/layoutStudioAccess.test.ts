import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const accountPageSource = readFileSync(new URL("../pages/AccountMockupPage.tsx", import.meta.url), "utf8");
const applicationRenderersSource = readFileSync(
  new URL("../components/applicationShortcodeRenderers.tsx", import.meta.url),
  "utf8",
);
const backendRequirementsSource = readFileSync(new URL("./backendDataRequirements.ts", import.meta.url), "utf8");
const prerenderSource = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");
const staticHeadersSource = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

test("Layout Studio and Shortcodes are public presentation routes", () => {
  assert.match(
    appSource,
    /<Route path="\/layout-studio" element=\{<HiddenPresentationRoute title="Layout Studio"><LayoutStudioMockupPage \/><\/HiddenPresentationRoute>\} \/>/,
  );
  assert.match(
    appSource,
    /<Route path="\/shortcodes" element=\{<HiddenPresentationRoute title="Shortcode library"><ShortcodeLibraryMockupPage \/><\/HiddenPresentationRoute>\} \/>/,
  );
  assert.doesNotMatch(appSource, /AdminCapabilityRoute/);
});

test("presentation routes emit strict noindex metadata", () => {
  const match = appSource.match(/function HiddenPresentationRoute\([\s\S]*?\n\}/);
  assert.ok(match, "HiddenPresentationRoute function not found");
  assert.match(match[0], /robots="noindex, nofollow, noarchive, nosnippet"/);
});

test("Layout Studio remains language-independent", () => {
  assert.match(appSource, /\[["']shortcodes["'],\s*["']layout-studio["']\]/);
});

test("the account control exposes Layout Studio without a capability gate", () => {
  assert.match(accountPageSource, /to="\/layout-studio"/);
  assert.doesNotMatch(accountPageSource, /canManageLayouts|manage_options/);
});

test("generated route manifests and sitemaps omit presentation routes", () => {
  assert.match(prerenderSource, /\["\/shortcodes", "\/layout-studio"\]/);
  assert.match(prerenderSource, /for \(const path of hiddenPresentationPaths\) routesByPath\.delete\(path\)/);
  assert.match(prerenderSource, /"\/shortcodes",\s*"  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet"/);
  assert.match(prerenderSource, /"\/layout-studio",\s*"  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet"/);
  assert.match(staticHeadersSource, /\/shortcodes\s+X-Robots-Tag: noindex, nofollow, noarchive, nosnippet/);
  assert.match(staticHeadersSource, /\/layout-studio\s+X-Robots-Tag: noindex, nofollow, noarchive, nosnippet/);
});

test("localized account pages keep Community data active independently of Studio access", () => {
  assert.match(applicationRenderersSource, /data-funkycommerce-component=\{names\[0\]\}/);
  assert.match(
    backendRequirementsSource,
    /\["account", "funkycommerce_account", "woocommerce_my_account"\]\.includes\(name\)/,
  );
});
