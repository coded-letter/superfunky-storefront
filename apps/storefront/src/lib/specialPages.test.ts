import assert from "node:assert/strict";
import test from "node:test";
import type { CmsPage } from "./pages";
import { resolveLocalizedSpecialPage } from "./specialPages.ts";

function page(languageCode: string, translations: CmsPage["translations"] = []): CmsPage {
  return { languageCode, translations } as CmsPage;
}

test("uses the language-prefixed special page when it matches", async () => {
  const calls: string[] = [];
  const expected = page("el");
  const result = await resolveLocalizedSpecialPage("404", "EL", async (uri) => {
    calls.push(uri);
    return expected;
  });

  assert.equal(result, expected);
  assert.deepEqual(calls, ["/el/404/"]);
});

test("resolves the requested translation from the default special page", async () => {
  const translated = page("el");
  const result = await resolveLocalizedSpecialPage("404", "el", async (uri) => {
    if (uri === "/el/404/") return null;
    if (uri === "/404/") return page("en", [{ databaseId: 2, languageCode: "el", uri: "/el/not-found/" }]);
    return translated;
  });

  assert.equal(result, translated);
});

test("returns null when no matching special page translation exists", async () => {
  const result = await resolveLocalizedSpecialPage("404", "el", async (uri) =>
    uri === "/404/" ? page("en") : null,
  );

  assert.equal(result, null);
});

test("falls back to the WordPress-safe 4o4 page slug", async () => {
  const calls: string[] = [];
  const expected = page("en");
  const result = await resolveLocalizedSpecialPage("404", "en", async (uri) => {
    calls.push(uri);
    return uri === "/en/4o4/" ? expected : null;
  });

  assert.equal(result, expected);
  assert.deepEqual(calls, ["/en/404/", "/404/", "/en/4o4/"]);
});
