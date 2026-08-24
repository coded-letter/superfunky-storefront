import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mapStorefrontSearchResults,
  type StorefrontSearchQueryResult,
} from "./searchMapping.ts";
import {
  COMPATIBLE_SEARCH_QUERY,
  isLegacyCommunityMemberSearchSchema,
  isSearchCompatibilitySchemaError,
  LEGACY_SEARCH_QUERY,
  SEARCH_QUERY,
} from "./searchQuery.ts";
import { searchWordPressRest } from "./searchRest.ts";

const backend = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/community.php", import.meta.url),
  "utf8",
);
const searchAutocomplete = readFileSync(
  new URL("../../../../packages/ui/src/layout/SearchAutocomplete.tsx", import.meta.url),
  "utf8",
);
const assistant = readFileSync(
  new URL("../components/AiShoppingAssistant.tsx", import.meta.url),
  "utf8",
);
const prerender = readFileSync(new URL("../../scripts/prerender.mjs", import.meta.url), "utf8");

const node = (id: string, name: string, slug: string, uri: string | null = null) => ({
  id,
  name,
  title: name,
  slug,
  uri,
});

test("maps every searchable archive family to canonical storefront routes", () => {
  const data: StorefrontSearchQueryResult = {
    products: { nodes: [node("product", "Orbit &amp; Bag", "orbit-bag", "/product/orbit-bag/")] },
    posts: { nodes: [node("post", "Orbit story", "orbit-story", "/en/orbit-story/")] },
    pages: { nodes: [node("page", "Duplicate product page", "duplicate", "/product/orbit-bag/")] },
    postCategories: { nodes: [node("post-category", "Guides", "guides")] },
    postTags: { nodes: [node("post-tag", "Orbit", "orbit")] },
    productCategories: { nodes: [node("product-category", "Accessories", "accessories")] },
    productTags: { nodes: [node("product-tag", "Crossbody", "crossbody")] },
    productBrands: { nodes: [node("brand", "Nebula", "nebula")] },
    authors: {
      nodes: [{ id: "author", databaseId: 5, name: "Ava Writer", slug: "ava-writer", uri: "/author/ava-writer/" }],
    },
    communityPosts: { nodes: [node("community-post", "Orbit desk setup", "orbit-desk", "/en/community_post/orbit-desk/")] },
    communityTags: { nodes: [node("community-tag", "Setups", "setups")] },
    communityMembers: [
      {
        databaseId: 7,
        name: "Orbit Maker",
        communityHandle: "Orbit-Maker",
        description: "Builds accessories",
        communityProfilePublic: true,
      },
      {
        databaseId: 8,
        name: "Private Orbit",
        communityHandle: "private-orbit",
        description: "",
        communityProfilePublic: false,
      },
      {
        databaseId: 9,
        name: "Malformed Orbit",
        communityHandle: "malformed/orbit",
        description: "",
        communityProfilePublic: true,
      },
    ],
  };

  const results = mapStorefrontSearchResults(
    data,
    "orbit",
    "EN",
    (key) => key,
    (value) => value.replaceAll("&amp;", "&"),
  );
  const byType = new Map(results.map((result) => [result.type, result]));

  assert.equal(byType.get("product")?.title, "Orbit & Bag");
  assert.equal(byType.get("product")?.href, "/product/orbit-bag");
  assert.equal(byType.get("post")?.href, "/en/orbit-story/");
  assert.equal(byType.get("post_category")?.href, "/blog/category/guides");
  assert.equal(byType.get("post_tag")?.href, "/blog/tag/orbit");
  assert.equal(byType.get("product_category")?.href, "/shop/category/accessories");
  assert.equal(byType.get("product_tag")?.href, "/shop/tag/crossbody");
  assert.equal(byType.get("product_brand")?.href, "/shop/brand/nebula");
  assert.equal(byType.get("author")?.href, "/en/author/ava-writer");
  assert.equal(byType.get("community_post")?.href, "/en/community_post/orbit-desk");
  assert.equal(byType.get("community_tag")?.href, "/en/community-tag/setups");
  assert.equal(byType.get("community_author")?.href, "/en/community/orbit-maker");
  assert.equal(results.filter(({ href }) => href.replace(/\/+$/, "") === "/product/orbit-bag").length, 1);
  assert.equal(results.some(({ title }) => title === "Private Orbit"), false);
  assert.equal(results.some(({ title }) => title === "Malformed Orbit"), false);
});

test("search debounce survives runtime callback churn", () => {
  assert.match(searchAutocomplete, /const searchRef = useRef\(search\)/);
  assert.match(searchAutocomplete, /const translateRef = useRef\(t\)/);
  assert.match(searchAutocomplete, /const searchTimeoutRef = useRef<number \| null>\(null\)/);
  assert.match(searchAutocomplete, /if \(searchContextRef\.current === nextContext\) return/);
  assert.match(searchAutocomplete, /setRemoteResults\(\[\]\);[\s\S]*scheduleSearchRef\.current\(query\)/);
  assert.match(searchAutocomplete, /\[hasRemoteSearch, languageBackendCode, languageCode\]/);
  assert.doesNotMatch(searchAutocomplete, /\[query, search, t\]/);
});

test("assistant discovery depends on configuration values rather than object identity", () => {
  assert.match(assistant, /assistantConfig\?\.enabled/);
  assert.match(assistant, /assistantConfig\?\.iframeReferrerPolicy/);
  assert.doesNotMatch(assistant, /\[storefrontConfig\?\.aiAssistant\]/);
});

test("prerender discovers the backend default language even when GraphQL omits that flag", () => {
  assert.match(prerender, /restLanguages\.find\(\(language\) => language\?\.is_default === true\)/);
  assert.match(prerender, /defaultLanguage = defaultRouteCode/);
});

test("search query language-filters supported content while keeping global profiles and brands", () => {
  assert.match(SEARCH_QUERY, /products[\s\S]*?language: \$language/);
  assert.match(SEARCH_QUERY, /communityPosts[\s\S]*?language: \$language/);
  assert.match(SEARCH_QUERY, /communityTags[\s\S]*?language: \$language/);
  assert.match(SEARCH_QUERY, /productBrands\(first: 4, where: \{ search: \$search, hideEmpty: true \}\)/);
  assert.match(SEARCH_QUERY, /authors: users\(first: 6, where: \{ search: \$search, hasPublishedPosts: POST \}\)/);
  assert.match(SEARCH_QUERY, /communityMembers\(search: \$search, first: 6\) \{/);
  assert.doesNotMatch(SEARCH_QUERY, /\bseo\b/i);
  assert.match(COMPATIBLE_SEARCH_QUERY, /posts\(first: 6, where: \{ search: \$search \}\)/);
  assert.doesNotMatch(COMPATIBLE_SEARCH_QUERY, /language|products|community|seo/i);
  assert.match(LEGACY_SEARCH_QUERY, /communityMembers \{/);
  assert.doesNotMatch(LEGACY_SEARCH_QUERY, /communityMembers\(/);
  assert.equal(
    isLegacyCommunityMemberSearchSchema([
      { message: 'Unknown argument "search" on field "RootQuery.communityMembers".' },
      { message: 'Unknown argument "first" on field "RootQuery.communityMembers".' },
    ]),
    true,
  );
  assert.equal(
    isLegacyCommunityMemberSearchSchema([{ message: 'Cannot query field "communityMembers".' }]),
    false,
  );
  assert.equal(
    isSearchCompatibilitySchemaError([
      { message: 'Unknown type "LanguageCodeFilterEnum".' },
      { message: 'Cannot query field "products" on type "RootQuery".' },
      { message: 'Field "language" is not defined by type "RootQueryToPostConnectionWhereArgs".' },
      { message: 'Field "language" is not defined by type "RootQueryToPageConnectionWhereArgs".' },
      { message: 'Field "language" is not defined by type "RootQueryToCategoryConnectionWhereArgs".' },
      { message: 'Field "language" is not defined by type "RootQueryToTagConnectionWhereArgs".' },
      { message: 'Cannot query field "productCategories" on type "RootQuery".' },
      { message: 'Cannot query field "productTags" on type "RootQuery".' },
      { message: 'Cannot query field "productBrands" on type "RootQuery".' },
    ]),
    true,
  );
  assert.equal(
    isSearchCompatibilitySchemaError([
      { message: 'Cannot query field "communityPosts" on type "RootQuery".' },
      { message: 'Cannot query field "communityTags" on type "RootQuery".' },
      { message: 'Cannot query field "communityMembers" on type "RootQuery".' },
    ]),
    true,
  );
  assert.equal(
    isSearchCompatibilitySchemaError([{ message: 'Cannot query field "somethingElse" on type "RootQuery".' }]),
    false,
  );
  assert.match(
    backend,
    /'communityMembers'[\s\S]*?'search' => array\( 'type' => 'String' \)[\s\S]*?'first'\s+=> array\( 'type' => 'Int' \)[\s\S]*?array_slice\( \$users, 0, min\( max\( absint\( \$args\['first'\] \), 1 \), 20 \) \)/,
  );
});

test("WordPress REST search avoids optional plugin fields and filters localized links", async () => {
  const requestedUrls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url);
    const common = [
      { id: 1, slug: "polski", link: "https://cms.example.test/polski/" },
      { id: 2, slug: "日本語", link: "https://cms.example.test/ja/%E6%97%A5%E6%9C%AC%E8%AA%9E/" },
    ];
    const payload = url.pathname.endsWith("/posts")
      ? common.map((node) => ({ ...node, title: { rendered: node.id === 2 ? "日本語の投稿" : "Polski post" } }))
      : url.pathname.endsWith("/pages")
        ? []
        : url.pathname.endsWith("/categories")
          ? common.map((node) => ({
              ...node,
              link: node.id === 2
                ? "https://cms.example.test/ja/category/%E6%97%A5%E6%9C%AC%E8%AA%9E/"
                : "https://cms.example.test/category/polski/",
              name: node.id === 2 ? "日本語カテゴリ" : "Polska kategoria",
            }))
          : url.pathname.endsWith("/tags")
            ? []
            : [];
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const results = await searchWordPressRest("surf", "ja", (key) => key, {
    backendOrigin: "https://cms.example.test",
    defaultLanguage: "pl",
    expectedLocales: ["pl", "en", "ja"],
    fetchImpl,
  });
  const polishResults = await searchWordPressRest("surf", "pl", (key) => key, {
    backendOrigin: "https://cms.example.test",
    defaultLanguage: "pl",
    expectedLocales: ["pl", "en", "ja"],
    fetchImpl,
  });

  assert.deepEqual(
    results.filter(({ type }) => type === "post" || type === "post_category")
      .map(({ href }) => href),
    ["/ja/%E6%97%A5%E6%9C%AC%E8%AA%9E/", "/ja/category/%E6%97%A5%E6%9C%AC%E8%AA%9E/"],
  );
  assert.equal(results.some(({ title }) => title.includes("Polsk")), false);
  assert.deepEqual(
    polishResults.filter(({ type }) => type === "post" || type === "post_category")
      .map(({ href }) => href),
    ["/polski/", "/category/polski/"],
  );
  assert.equal(polishResults.some(({ title }) => title.includes("日本語")), false);
  assert.equal(results.some(({ type }) => type === "author"), false);
  assert.equal(requestedUrls.length, 8);
  requestedUrls.slice(0, 4).forEach((url) => {
    assert.equal(url.searchParams.get("lang"), "ja");
    assert.equal(url.searchParams.has("seo"), false);
    assert.doesNotMatch(url.searchParams.get("_fields") || "", /seo|language/i);
  });
  requestedUrls.slice(4).forEach((url) => assert.equal(url.searchParams.get("lang"), "pl"));
});
