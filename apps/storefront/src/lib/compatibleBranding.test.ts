import assert from "node:assert/strict";
import test from "node:test";

import { resolveCompatibleBranding, type CompatibleBranding } from "./compatibleBranding.ts";

const defaults: CompatibleBranding = {
  storeName: "Superfunky",
  companyName: "Superfunky",
  tagline: "Modern storefront mockup",
  logoUrl: null,
  iconUrl: null,
  promoHtml: "",
};

test("free-profile branding prefers theme settings", () => {
  assert.deepEqual(
    resolveCompatibleBranding({
      generalSettings: { title: "Core shop", description: "Core tagline" },
      storefrontConfig: {
        branding: {
          storeName: "Your dream shop",
          companyName: "Shop company",
          tagline: "The next big thing",
          logoUrl: "https://cms.example.test/logo.svg",
          iconUrl: "",
          promoHtml: "<strong>Free delivery</strong>",
        },
      },
    }, defaults),
    {
      storeName: "Your dream shop",
      companyName: "Shop company",
      tagline: "The next big thing",
      logoUrl: "https://cms.example.test/logo.svg",
      iconUrl: null,
      promoHtml: "<strong>Free delivery</strong>",
    },
  );
});

test("free-profile branding falls back to core site identity", () => {
  assert.deepEqual(
    resolveCompatibleBranding({
      generalSettings: { title: "Minimal site", description: "No optional plugins" },
      storefrontConfig: { branding: null },
    }, defaults),
    {
      storeName: "Minimal site",
      companyName: "Minimal site",
      tagline: "No optional plugins",
      logoUrl: null,
      iconUrl: null,
      promoHtml: "",
    },
  );
});
