import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const cmsPageSource = readFileSync(new URL("../components/CmsPageContent.tsx", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("../pages/CommunityProfileMockupPage.tsx", import.meta.url), "utf8");
const authorsSource = readFileSync(new URL("./authors.ts", import.meta.url), "utf8");

test("localized Polish community routes use the community page resolver", () => {
  assert.match(appSource, /<Route path="\/spolecznosc" element=\{<StorefrontRedirectRoute routeKey="community"/);
  assert.match(appSource, /<Route path="\/:language\/spolecznosc"/);
});

test("community page shortcodes render eagerly instead of waiting for scroll", () => {
  assert.match(cmsPageSource, /isCommunityRoute && marker\.name\.startsWith\("community-"\)/);
  assert.match(cmsPageSource, /const active = eager \|\| observed/);
});

test("multilingual profile and author feeds filter nodes by selected language", () => {
  assert.match(profileSource, /configuredLanguageCodes\.length > 1/);
  assert.match(profileSource, /post\.languageCode\.toLowerCase\(\) === languageCode/);
  assert.match(authorsSource, /matchesAuthorPostLanguage\(post, normalizedRequestedLanguageCode, configuredLanguageCodes\)/);
  assert.match(authorsSource, /if \(postLanguage\) return postLanguage === requestedLanguage;/);
});
