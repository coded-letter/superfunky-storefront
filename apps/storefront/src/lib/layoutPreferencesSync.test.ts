import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// `layoutPreferencesSync.ts` imports `@funky/ui` and `./navigation`, both of which are
// bare/extensionless specifiers only resolvable through the app's bundler (Vite) — not
// through plain Node ESM — so (consistent with this codebase's other `lib/*.test.ts`
// files, e.g. `navigation.test.ts`/`profileHeaderSharing.test.ts`) this file asserts
// against the module's source text rather than importing and invoking it directly.
const syncSource = readFileSync(new URL("./layoutPreferencesSync.ts", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("./navigation.ts", import.meta.url), "utf8");

function extractApplyLayoutConfigurationBody(source: string): string {
  const match = source.match(/export function applyLayoutConfiguration\([\s\S]*?\n\}/);
  assert.ok(match, "applyLayoutConfiguration not found in layoutPreferencesSync.ts");
  return match[0];
}

function extractLayoutConfigurationFields(source: string): string[] {
  const match = source.match(/export type StorefrontLayoutConfiguration = \{([\s\S]*?)\n\};/);
  assert.ok(match, "could not locate StorefrontLayoutConfiguration type in navigation.ts");
  const fields: string[] = [];
  for (const line of match[1].split("\n")) {
    const fieldMatch = line.match(/^\s*(\w+)\??:/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields;
}

// Fields represented via the derived `hiddenFooterPaymentMethodKeys`/
// `hiddenFooterSocialLinkKeys` arrays (see `mapLayoutToHiddenFooterKeys`) rather than
// one `setX(layout.x)` call per boolean, plus the non-field `schemaVersion` metadata key.
const DERIVED_OR_METADATA_FIELDS = new Set([
  "schemaVersion",
  "showFooterPaymentVisa",
  "showFooterPaymentMastercard",
  "showFooterPaymentPaypal",
  "showFooterPaymentApay",
  "showFooterPaymentGpay",
  "showFooterPaymentStripe",
  "showFooterPaymentBlik",
  "showFooterPaymentBtc",
  "showFooterPaymentEth",
  "showFooterSocialBehance",
  "showFooterSocialDiscord",
  "showFooterSocialFacebook",
  "showFooterSocialGithub",
  "showFooterSocialGoogle",
  "showFooterSocialInstagram",
  "showFooterSocialLinkedin",
  "showFooterSocialPatreon",
  "showFooterSocialSlack",
  "showFooterSocialTiktok",
  "showFooterSocialTwitch",
  "showFooterSocialTwitter",
  "showFooterSocialX",
  "showFooterSocialYoutube",
]);

test("applyLayoutConfiguration hydrates every StorefrontLayoutConfiguration field from the backend layout config", () => {
  const body = extractApplyLayoutConfigurationBody(syncSource);
  const fields = extractLayoutConfigurationFields(navigationSource);
  assert.ok(fields.length > 50, "sanity check: schema should have many fields");

  const missing: string[] = [];
  for (const field of fields) {
    if (DERIVED_OR_METADATA_FIELDS.has(field)) continue;
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const callPattern = new RegExp(`prefs\\.${setterName}\\(layout\\.${field}\\)`);
    if (!callPattern.test(body)) missing.push(field);
  }
  assert.deepEqual(missing, [], `applyLayoutConfiguration is missing a hydration call for: ${missing.join(", ")}`);

  // Explicitly re-confirm the page/CMS controls that previously stopped at normalization.
  for (const groupAField of [
    "homeHeroLayout",
    "shopProductCardVariant",
    "authLayout",
    "readingListLayout",
    "wishlistCardVariant",
    "communityFeedLayout",
    "communityFeedLoadMode",
    "communityFeedPageSize",
    "communityFeedFilters",
    "cartLayout",
    "cartSummaryPosition",
    "communityProfileHeaderLayout",
    "authorProfileHeaderLayout",
    "productArchiveHeroLayout",
    "showProductArchiveSubcategories",
    "postArchiveHeroLayout",
    "postTocLayout",
    "postSharePosition",
    "postAuthorLayout",
    "discussionLayout",
  ]) {
    const setterName = `set${groupAField.charAt(0).toUpperCase()}${groupAField.slice(1)}`;
    assert.match(body, new RegExp(`prefs\\.${setterName}\\(layout\\.${groupAField}\\)`));
  }
});

test("applyLayoutConfiguration derives the hidden footer payment/social key arrays rather than hydrating 14 separate booleans directly", () => {
  const body = extractApplyLayoutConfigurationBody(syncSource);
  assert.match(body, /mapLayoutToHiddenFooterKeys\(layout\)/);
  assert.match(body, /prefs\.setHiddenFooterPaymentMethodKeys\(hiddenFooterPaymentMethodKeys\)/);
  assert.match(body, /prefs\.setHiddenFooterSocialLinkKeys\(hiddenFooterSocialLinkKeys\)/);
});

test("applyLayoutConfiguration performs no network/persistence calls — it is a pure, synchronous, one-directional (backend → context) hydration", () => {
  assert.doesNotMatch(syncSource, /fetch\(|axios|XMLHttpRequest/);
  assert.doesNotMatch(syncSource, /saveLayoutPreferences|loadLayoutPreferences/);
});

test("backend Layout Studio palette remains the authoritative storefront brand palette", () => {
  const body = extractApplyLayoutConfigurationBody(syncSource);
  assert.match(body, /prefs\.setBrandPalette\(layout\.brandPalette\)/);
  assert.match(body, /prefs\.setBrandGradientStyle\(layout\.brandGradientStyle\)/);
  assert.doesNotMatch(body, /prefs\.syncBrandPalette\(layout\.brandPalette\)/);
  assert.doesNotMatch(body, /prefs\.syncBrandGradientStyle\(layout\.brandGradientStyle\)/);
});

test("fresh backend palette values are never overwritten by a stale prerendered seed", () => {
  assert.doesNotMatch(syncSource, /storefront-static-layout|withStaticPaletteSeed|staticPaletteSeedApplied/);
  assert.match(syncSource, /applyLayoutConfiguration\(prefs, layout\)/);
});

test("session-local editing can suspend backend reconciliation while Layout Studio remains active", () => {
  const effectMatch = syncSource.match(/useLayoutEffect\(\(\) => \{[\s\S]*?\}, (\[[^\]]*\])\);/);
  assert.ok(effectMatch, "expected a useLayoutEffect with an explicit dependency array");
  assert.equal(effectMatch[1].trim(), "[enabled, layoutSignature, prefs.isLayoutPreviewActive]");
  assert.match(syncSource, /if \(!enabled \|\| !layout \|\| !layoutSignature \|\| prefs\.isLayoutPreviewActive\)/);
});

test("equivalent backend layout objects reconcile only once", () => {
  assert.match(syncSource, /const layoutSignature = enabled && layout \? JSON\.stringify\(layout\) : null/);
  assert.match(syncSource, /if \(appliedLayoutSignature\.current === layoutSignature\) return/);
  assert.ok(
    syncSource.indexOf("appliedLayoutSignature.current = layoutSignature")
      < syncSource.indexOf("applyLayoutConfiguration(prefs, layout)"),
    "the signature must be committed before setters trigger a rerender",
  );
});
