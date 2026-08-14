import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This test guards against drift between `StorefrontLayoutConfiguration` (the backend
// Control Center schema, normalized in `navigation.ts`) and the restored Layout Studio
// page: every field must be accounted for as EITHER a live, session-local Studio
// control OR an explicitly documented backend-only/shortcode-attribute-default entry
// in `BACKEND_ONLY_SETTINGS` — never silently missing from both, and never present in
// both (which would wrongly imply a shortcode-scoped default is a global toggle).

const navigationSource = readFileSync(new URL("./navigation.ts", import.meta.url), "utf8");
const studioSource = readFileSync(new URL("../pages/LayoutStudioMockupPage.tsx", import.meta.url), "utf8");

function extractLayoutConfigurationFields(source: string): string[] {
  const match = source.match(/export type StorefrontLayoutConfiguration = \{([\s\S]*?)\n\};/);
  assert.ok(match, "could not locate `StorefrontLayoutConfiguration` type in navigation.ts");
  const body = match[1];
  const fields: string[] = [];
  for (const line of body.split("\n")) {
    const fieldMatch = line.match(/^\s*(\w+)\??:/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields;
}

// Fields that are intentionally not represented 1:1 as a single Studio control because
// they're either metadata (`schemaVersion`) or exposed through an aggregate/derived
// control (`showFooterPayment*`/`showFooterSocial*` → the `hiddenFooterPaymentMethodKeys`/
// `hiddenFooterSocialLinkKeys` per-item toggle lists driven by `PAYMENT_METHODS`/
// `SOCIAL_LINKS`, which the studio *does* let an admin flip live via
// `toggleFooterPaymentMethodKey`/`toggleFooterSocialLinkKey`).
const AGGREGATE_OR_METADATA_FIELDS = new Set([
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

function extractBackendOnlyFields(source: string): string[] {
  const match = source.match(/const BACKEND_ONLY_SETTINGS: BackendOnlySetting\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(match, "could not locate BACKEND_ONLY_SETTINGS in LayoutStudioMockupPage.tsx");
  const body = match[1];
  const fields: string[] = [];
  for (const fieldMatch of body.matchAll(/field:\s*"([\w]+)"/g)) {
    fields.push(fieldMatch[1]);
  }
  return fields;
}

test("every StorefrontLayoutConfiguration field is a live Studio control, a documented backend-only default, or an aggregate/metadata field", () => {
  const schemaFields = extractLayoutConfigurationFields(navigationSource);
  assert.ok(schemaFields.length > 50, "sanity check: expected the schema to have many fields");

  const backendOnlyFields = extractBackendOnlyFields(studioSource);
  assert.ok(backendOnlyFields.length > 0, "expected at least one documented backend-only setting");

  const missing: string[] = [];
  for (const field of schemaFields) {
    if (AGGREGATE_OR_METADATA_FIELDS.has(field)) continue;
    const isBackendOnly = backendOnlyFields.includes(field);
    // A live Studio control reads the field from `useLayoutPreferences()` (the field
    // name appears as a destructured value) AND writes it back via its matching
    // `set<Field>` setter somewhere in the JSX.
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const isLiveControl = studioSource.includes(setterName);
    if (isBackendOnly === isLiveControl) {
      // Either present nowhere (isBackendOnly=false, isLiveControl=false) or wrongly
      // duplicated in both places (isBackendOnly=true, isLiveControl=true).
      missing.push(`${field} (backendOnly=${isBackendOnly}, liveControl=${isLiveControl})`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `every schema field must be exactly one of {live Studio control, documented backend-only setting}: ${missing.join(", ")}`,
  );
});

test("BACKEND_ONLY_SETTINGS entries are all real schema fields (no stale/typo'd field names)", () => {
  const schemaFields = new Set(extractLayoutConfigurationFields(navigationSource));
  const backendOnlyFields = extractBackendOnlyFields(studioSource);
  for (const field of backendOnlyFields) {
    assert.ok(schemaFields.has(field), `BACKEND_ONLY_SETTINGS references unknown field "${field}"`);
  }
});

test("BACKEND_ONLY_SETTINGS documents each entry as a shortcode/CMS-area default, not a global toggle", () => {
  // Guards against silently turning a per-shortcode-instance default into a
  // page-copy that implies it's a site-wide setting.
  assert.match(studioSource, /not a global (site )?setting|per-instance|shortcode-specific/i);
});
