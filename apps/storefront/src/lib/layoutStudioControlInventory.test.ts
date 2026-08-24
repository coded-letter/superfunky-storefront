import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This test guards against drift between `StorefrontLayoutConfiguration` (the backend
// Control Center schema, normalized in `navigation.ts`) and Layout Studio: every
// editable global field must have a live, session-local Studio setter.

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

test("every StorefrontLayoutConfiguration field is a live Studio control or an aggregate/metadata field", () => {
  const schemaFields = extractLayoutConfigurationFields(navigationSource);
  assert.ok(schemaFields.length > 50, "sanity check: expected the schema to have many fields");

  const missing: string[] = [];
  for (const field of schemaFields) {
    if (AGGREGATE_OR_METADATA_FIELDS.has(field)) continue;
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const isLiveControl = studioSource.includes(setterName);
    if (!isLiveControl) missing.push(field);
  }

  assert.deepEqual(
    missing,
    [],
    `every schema field must be a live Studio control: ${missing.join(", ")}`,
  );
});

test("Layout Studio no longer classifies global backend controls as backend-only shortcode defaults", () => {
  assert.doesNotMatch(studioSource, /BACKEND_ONLY_SETTINGS|Backend-only — Control Center/);
});
