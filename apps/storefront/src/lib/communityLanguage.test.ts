import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  communityPostSlugFromUri,
  filterCommunityPostsByLanguage,
  withoutCommunityLocalizationFields,
} from "./community.ts";

const communitySource = readFileSync(fileURLToPath(new URL("./community.ts", import.meta.url)), "utf8");
const authorSource = readFileSync(fileURLToPath(new URL("./authors.ts", import.meta.url)), "utf8");
const authorPageSource = readFileSync(fileURLToPath(new URL("../pages/AuthorMockupPage.tsx", import.meta.url)), "utf8");
const communityBackendSource = readFileSync(
  fileURLToPath(new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/community.php", import.meta.url)),
  "utf8",
);
const multilingualBackendSource = readFileSync(
  fileURLToPath(new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/multilingual-content.php", import.meta.url)),
  "utf8",
);

test("community collections retain only posts for the selected language", () => {
  const posts = [
    { id: 1, languageCode: "PL" },
    { id: 2, languageCode: "en" },
    { id: 3, languageCode: "ja" },
  ];

  assert.deepEqual(filterCommunityPostsByLanguage(posts, "pl"), [posts[0]]);
  assert.deepEqual(filterCommunityPostsByLanguage(posts, "EN"), [posts[1]]);
});

test("community post routes resolve localized unicode slugs without nodeByUri", () => {
  assert.equal(communityPostSlugFromUri("/en/community_post/surfboards/"), "surfboards");
  assert.equal(
    communityPostSlugFromUri("/ja/community_post/%E3%82%B5%E3%83%BC%E3%83%95%E3%83%9C%E3%83%BC%E3%83%89/"),
    "サーフボード",
  );
  assert.match(communitySource, /communityPost\(id: \$slug, idType: SLUG\)/);
  assert.doesNotMatch(communitySource, /nodeByUri\(uri:/);
});

test("community post queries use the theme's safe multilingual fields", () => {
  assert.match(communitySource, /language: funkycommerceLanguage \{/);
  assert.match(communitySource, /translations: funkycommerceTranslations \{/);
  assert.doesNotMatch(communitySource, /communityPosts\(first: 100, where: \{ language:/);
  assert.match(multilingualBackendSource, /'funkycommerceTranslations'/);
  assert.match(communitySource, /while \(pageInfo\.hasNextPage\)/);
  assert.match(communitySource, /loadRemainingCommunityPosts\(data\.communityPosts/);
  assert.match(
    communitySource,
    /while \(pageInfo\.hasNextPage && filterRawNodesByLanguage\(posts, languageCode\)\.length < 12\)/,
  );
  assert.match(communitySource, /COMMUNITY_FEED_PAGE_QUERY/);
  assert.ok(
    communitySource.indexOf("translationsFieldUnavailable") <
      communitySource.indexOf("withoutCommunityLocalizationFields(compatibleQuery)"),
    "the rolling-backend retry should remove translations before removing the supported language field",
  );
});

test("community archives derive tags and authors only from localized posts", () => {
  assert.match(
    communitySource,
    /const localizedRawPosts = rawPosts\.filter\(\(post\) =>[\s\S]*post\.language\.code\.toLowerCase\(\) === backendLanguageCode\.toLowerCase\(\)/,
  );
  assert.match(communitySource, /const posts = localizedRawPosts\.flatMap/);
  assert.match(communitySource, /localizedRawPosts\.flatMap\(\(post\) => post\.author\?\.node/);
});

test("author archive compatibility filters language-less results by localized URI", () => {
  assert.match(authorSource, /export function matchesAuthorPostLanguage/);
  assert.match(authorSource, /if \(postLanguage\) return postLanguage === requestedLanguage/);
  assert.match(authorSource, /requestedLanguage === configured\[0\][\s\S]*!configured\.slice\(1\)\.includes\(prefix\)[\s\S]*prefix === requestedLanguage/);
  assert.match(authorPageSource, /configuredLanguageCodes\.join\(","\)/);
  assert.match(authorPageSource, /getAuthorArchive\([\s\S]*requestedLanguage,[\s\S]*configuredLanguageCodes/);
});

test("community profile products and articles request and apply Polylang language scoping", () => {
  // The backend resolves a profile's marketplace products/blog articles via
  // get_posts()/wc_post loaders that suppress Polylang's automatic language
  // filtering, so the storefront must both request each node's language and
  // filter client-side, mirroring how posts/followingFeed are already handled.
  assert.match(
    communitySource,
    /shortDescription\(format: RENDERED\)[\s\S]{0,200}productBrands \{ nodes \{ name uri \} \}\s*\n\s*language \{ code \}/,
  );
  assert.match(
    communitySource,
    /featuredImage \{ node \{ sourceUrl\(size: MEDIUM_LARGE\) \} \}\s*\n\s*language \{ code \}\s*\n\s*\}\s*\n\s*\}\s*\n\s*\}\s*\n\s*\$\{COMMUNITY_PROFILE_MEMBER_FIELDS\}/,
  );
  assert.match(
    communitySource,
    /function filterRawNodesByLanguage<T extends \{ language\?: \{ code\?: string \| null \} \| null \}>/,
  );
  assert.match(
    communitySource,
    /products\(language: \$languageSlug\)[\s\S]*products: filterRawNodesByLanguage\(profile\.products \|\| \[\], languageCode\)\.map\(\(product\) => mapProfileProduct\(product\)\)/,
  );
  assert.match(
    communitySource,
    /articles\(language: \$languageSlug\)[\s\S]*articles: filterRawNodesByLanguage\(profile\.articles \|\| \[\], languageCode\)\.map\(\(article\) => mapProfileArticle\(article, member\)\)/,
  );
  assert.match(communitySource, /posts\(language: \$languageSlug\)/);
  assert.match(communitySource, /followingFeed\(language: \$languageSlug\)/);
  assert.match(communitySource, /languageSlug: languageCode\.toLowerCase\(\)/);
});

test("community profile resolvers scope every content collection before loading nodes", () => {
  for (const field of ["posts", "articles", "followingFeed", "products"]) {
    assert.match(
      communityBackendSource,
      new RegExp(`'${field}'[\\s\\S]{0,350}'language'\\s*=>\\s*array\\(\\s*'type'\\s*=>\\s*'String'`),
    );
  }
  assert.match(communityBackendSource, /\$query_args\['lang'\]\s*=\s*\$language/);
  assert.match(
    communityBackendSource,
    /funkycommerce_get_seller_product_ids\( array\( \$user->ID \), 100, \$language \)/,
  );
});

test("stripping optional community localization fields fully removes the nested translations block", () => {
  // Regression test: a single community post's detail query nests a `language { code }`
  // field inside `translations { databaseId uri language { code } }`. The generic,
  // standalone `language { code }` strip must not run before the `translations { ... }`
  // strip, otherwise it greedily eats the nested `language { code }` first and leaves a
  // dangling `translations { databaseId uri }` field that still doesn't exist on schemas
  // without Polylang support — causing the retried "compat" request to fail with the
  // exact same GraphQL error and the community post page to render as permanently
  // unavailable ("down") instead of recovering.
  const fragment = `
    id
    databaseId
    language { code }
    translations {
      databaseId
      uri
      language {
        code
      }
    }
    featuredImage {
      node { sourceUrl }
    }
  `;

  const stripped = withoutCommunityLocalizationFields(fragment);
  assert.doesNotMatch(stripped, /language\s*\{/);
  assert.doesNotMatch(stripped, /translations\s*\{/);
});

test("compat stripping removes profile language arguments as well as localization selections", () => {
  const stripped = withoutCommunityLocalizationFields(`
    query Profile($handle: String!, $languageSlug: String!, $sellerId: Int) {
      communityProfileByHandle(handle: $handle) {
        posts(language: $languageSlug) {
          language { code }
        }
      }
      marketplaceProducts(first: 48, language: $languageSlug) { id }
      viewerProducts: marketplaceProducts(language: $languageSlug, sellerId: $sellerId) { id }
    }
  `);

  assert.doesNotMatch(stripped, /\$languageSlug/);
  assert.doesNotMatch(stripped, /language\s*:/);
  assert.doesNotMatch(stripped, /language\s*\{/);
  assert.match(stripped, /marketplaceProducts\(first: 48\)/);
  assert.match(stripped, /marketplaceProducts\(sellerId: \$sellerId\)/);
});

test("the community post detail fragment's translations block is fully removed by the compat fallback", () => {
  const fragmentMatch = communitySource.match(/const COMMUNITY_POST_FIELDS = \/\* GraphQL \*\/ `([\s\S]*?)`;/);
  assert.ok(fragmentMatch, "expected to find COMMUNITY_POST_FIELDS in community.ts");
  const stripped = withoutCommunityLocalizationFields(fragmentMatch[1]);
  assert.doesNotMatch(stripped, /language\s*\{/);
  assert.doesNotMatch(stripped, /translations\s*\{/);
  assert.doesNotMatch(stripped, /funkycommerceLanguage/);
  assert.doesNotMatch(stripped, /funkycommerceTranslations/);
});
