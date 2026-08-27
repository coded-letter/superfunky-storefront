import assert from "node:assert/strict";
import test from "node:test";
import { backendPostUriFromStorefrontPath, storefrontPostPath } from "./postRoutePaths.mjs";

test("canonical post paths use the storefront blog route", () => {
  assert.equal(
    storefrontPostPath({
      uri: "/custom-wp-plugins-and-their-compatibility/",
      slug: "custom-wp-plugins-and-their-compatibility",
      languageCode: "en",
      defaultLanguage: "en",
      configuredLanguageCodes: ["en"],
    }),
    "/blog/custom-wp-plugins-and-their-compatibility",
  );
  assert.equal(
    storefrontPostPath({
      uri: "/pl/wtyczki/",
      slug: "wtyczki",
      languageCode: "pl",
      defaultLanguage: "en",
      configuredLanguageCodes: ["en", "pl"],
    }),
    "/pl/blog/wtyczki",
  );
});

test("blog routes resolve to the backend post URI without routing through home", () => {
  assert.equal(
    backendPostUriFromStorefrontPath("/blog/custom-wp-plugins-and-their-compatibility"),
    "/custom-wp-plugins-and-their-compatibility/",
  );
  assert.equal(backendPostUriFromStorefrontPath("/pl/blog/wtyczki"), "/pl/wtyczki/");
  assert.equal(backendPostUriFromStorefrontPath("/2026/08/27/story"), "/2026/08/27/story/");
});
