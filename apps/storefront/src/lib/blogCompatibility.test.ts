import assert from "node:assert/strict";
import test from "node:test";

import { BLOG_DATA_COMPATIBILITY_RULES, createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { requestGraphqlWithCompatibility, type GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";
import { createCompatiblePostArchiveQuery } from "./postArchiveGraphqlCompatibility.ts";
import {
  AUTHOR_ARCHIVE_COMPATIBILITY_RULE,
  createCompatibleAuthorArchiveQuery,
} from "./authorArchiveGraphqlCompatibility.ts";
import { POST_GRAPHQL_COMPATIBILITY_RULES } from "./postGraphqlCompatibility.ts";
import {
  createCoreBlogQuery,
  createLanguageCompatiblePageQuery,
  createCorePageQuery,
  createCoreRouteRegistryQuery,
  createCorePostArchiveQuery,
  createCorePostQuery,
  createProfilePageQuery,
  createProfilePostQuery,
  shouldPreferCoreContentQueries,
  shouldPreferCoreGraphqlQueries,
} from "./profileGraphqlCompatibility.ts";
import { filterLocalizedBlogNodes } from "./blogLocalization.ts";

test("blog fallback removes Polylang requirements while preserving posts and SEO", () => {
  const query = `
    query Blog($language: LanguageCodeFilterEnum!) {
      posts(first: 100, where: { language: $language }) {
        nodes {
          title
          language { code }
          translations {
            uri
            language { code }
          }
          seo { readingTime }
        }
      }
      categories(first: 100, where: { hideEmpty: true, language: $language, orderby: COUNT }) {
        nodes {
          name
          language { code }
        }
      }
    }
  `;

  const compatible = createCompatibleBlogDataQuery(query);
  assert.doesNotMatch(compatible, /LanguageCodeFilterEnum|\$language|\blanguage\s*\{|\btranslations\s*\{/);
  assert.match(compatible, /posts\(first: 100\)/);
  assert.match(compatible, /\btitle\b/);
  assert.match(compatible, /\bseo\s*\{/);
});

test("blog fallback supports sticky posts, author pagination, and taxonomy archives", () => {
  const stickyQuery = `
    query Sticky($language: LanguageCodeFilterEnum!) {
      posts(where: { status: PUBLISH, language: $language, isSticky: true }) {
        nodes {
          title
          language {
            code
          }
        }
      }
    }
  `;
  const authorQuery = `
    query Authors($language: LanguageCodeFilterEnum!, $after: String) {
      posts(after: $after, where: { language: $language }) {
        nodes { author { node { name } } }
      }
    }
  `;
  const archiveQuery = `
    query Archive {
      archive: category(id: "news") {
        language {
          code
        }
        translations {
          uri
          language {
            code
          }
        }
        posts {
          nodes {
            title
            language {
              code
            }
            seo {
              readingTime
            }
          }
        }
      }
      terms: categories(where: { hideEmpty: true, language: ALL }) {
        nodes {
          name
          language {
            code
          }
        }
      }
    }
  `;

  const compatibleSticky = createCompatibleBlogDataQuery(stickyQuery);
  const compatibleAuthors = createCompatibleBlogDataQuery(authorQuery);
  const compatibleArchive = createCompatibleBlogDataQuery(archiveQuery);

  assert.doesNotMatch(compatibleSticky, /LanguageCodeFilterEnum|\$language|\blanguage\s*\{/);
  assert.match(compatibleSticky, /status: PUBLISH,\s*isSticky: true/);
  assert.doesNotMatch(compatibleAuthors, /LanguageCodeFilterEnum|\$language|where:\s*\{\s*\}/);
  assert.match(compatibleAuthors, /query Authors\(\$after: String\)/);
  assert.doesNotMatch(compatibleArchive, /\blanguage\s*(?:\{|:)|\btranslations\s*\{/);
  assert.match(compatibleArchive, /where:\s*\{\s*hideEmpty: true\s*\}/);
  assert.match(compatibleArchive, /\bseo\s*\{/);
});

test("blog fallback retries malformed language and publish-status resolvers", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("$language") || /status:\s*PUBLISH/.test(query)) {
      return {
        data: null,
        errors: [
          {
            message: "Internal server error",
            path: ["posts", "nodes", 0, "language"],
            extensions: { debugMessage: "Cannot access offset of type string on string" },
          },
          {
            message: "Internal server error",
            path: ["posts", "status"],
            extensions: { debugMessage: "Cannot access offset of type string on string" },
          },
        ],
      };
    }
    return { data: { posts: { nodes: [] } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query Sticky($language: LanguageCodeFilterEnum!) {
        posts(where: { status: PUBLISH, language: $language }) {
          nodes {
            title
            language { code }
          }
        }
        categories(first: 100, where: { hideEmpty: true, language: $language, orderby: COUNT }) {
          nodes {
            name
          }
        }
        comments(first: 20) {
          nodes {
            id
          }
        }
      }
    `,
    { language: "EN" },
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  assert.deepEqual(response.data, { posts: { nodes: [] } });
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /LanguageCodeFilterEnum|\$language|status:\s*PUBLISH/);
  assert.doesNotMatch(requestedQueries[1], /categories\([^)]*\bwhere:/);
  assert.match(requestedQueries[1], /\bcomments\s*\(/);
});

test("blog fallback retries opaque Polylang term-language resolver failures", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (requestedQueries.length === 1) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
          path: ["posts", "nodes", 0, "tags", "nodes", 0, "language", "code"],
        }],
      };
    }
    return { data: { posts: { nodes: [] }, categories: { nodes: [] }, tags: { nodes: [] } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query StorefrontBlogData($language: LanguageCodeFilterEnum!) {
        posts(first: 100, where: { language: $language }) {
          nodes {
            id
            tags {
              nodes {
                id
                language {
                  code
                }
              }
            }
          }
        }
      }
    `,
    { language: "PL" },
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  assert.equal(response.errors, undefined);
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\blanguage\s*\{/);
});

test("archive fallback keeps post cards and terms while dropping expensive optional fields", () => {
  const compatible = createCompatiblePostArchiveQuery(`
    query Archive {
      category {
        posts {
          nodes {
            title
            excerpt(format: RENDERED)
            content(format: RENDERED)
            seo {
              readingTime
            }
          }
        }
        enqueuedScripts {
          nodes {
            id
          }
        }
      }
      categories(where: { hideEmpty: true, language: ALL }) {
        nodes {
          name
          language { code }
          translations {
            uri
            language {
              code
            }
          }
        }
      }
    }
  `);

  assert.doesNotMatch(
    compatible,
    /\bcontent\s*\(|\bseo\s*\{|\benqueuedScripts\s*\{|\blanguage\s*(?:\{|\s*:)/,
  );
  assert.match(compatible, /\btranslations\s*\{\s*uri\b/);
  assert.match(compatible, /\bposts\s*\{|\btitle\b|\bexcerpt\s*\(|\bcategories\s*\{/);
});

test("author fallback fetches core posts without malformed connection filters", () => {
  const compatible = createCompatibleAuthorArchiveQuery(`
    query Author(
      $slug: ID!
      $authorName: String!
      $language: LanguageCodeFilterEnum!
    ) {
      user(id: $slug, idType: SLUG) {
        name
      }
      posts(first: 100, where: { authorName: $authorName, language: $language }) {
        nodes {
          title
          excerpt(format: RENDERED)
          content(format: RENDERED)
          language {
            code
          }
          seo {
            readingTime
          }
        }
      }
    }
  `);

  assert.doesNotMatch(
    compatible,
    /\$authorName|\$language|LanguageCodeFilterEnum|\bwhere\s*:|\blanguage\s*\{|\bcontent\s*\(|\bseo\s*\{/,
  );
  assert.match(compatible, /\$slug:\s*ID!|\bposts\(first: 100\)|\btitle\b|\bexcerpt\s*\(/);
});

test("author fallback handles malformed legacy Polylang term language values", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("language {")) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
          path: ["posts", "nodes", 0, "tags", "nodes", 0, "language", "code"],
          extensions: {
            debugMessage: "Expected a value of type LanguageCodeEnum but received: false. Cannot serialize value as enum: false",
          },
        }],
      };
    }
    return { data: { user: { id: "user-1" }, posts: { nodes: [] } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `query Author(
      $slug: ID!
      $authorName: String!
      $language: LanguageCodeFilterEnum!
    ) {
      user(id: $slug, idType: SLUG) {
        id
      }
      posts(first: 100, where: { authorName: $authorName, language: $language }) {
        nodes {
          title
          language {
            code
          }
        }
      }
    }`,
    { slug: "aris", authorName: "aris", language: "PL" },
    [AUTHOR_ARCHIVE_COMPATIBILITY_RULE],
  );

  assert.equal(response.errors, undefined);
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\$authorName|\$language|\blanguage\s*\{|\bwhere\s*:/);
});

test("post fallback preserves approved comments when only a Polylang resolver is malformed", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("language {")) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
          path: ["post", "language"],
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
      };
    }
    return { data: { post: { id: "post-1" } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query Post($uri: ID!) {
        post(id: $uri, idType: URI) {
          id
          language {
            code
          }
          translations {
            uri
            language {
              code
            }
          }
          categories {
            nodes {
              name
              language {
                code
              }
            }
          }
          comments(first: 100) {
            nodes {
              id
            }
          }
          seo {
            title
          }
        }
      }
    `,
    { uri: "/hello-world/" },
    POST_GRAPHQL_COMPATIBILITY_RULES,
  );
  assert.deepEqual(response.data, { post: { id: "post-1" } });
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\blanguage\s*\{|\btranslations\s*\{/);
  assert.match(requestedQueries[1], /\bcomments\s*\(/);
  assert.match(requestedQueries[1], /\bseo\s*\{/);
});

test("post fallback removes comments only when the comments resolver is malformed", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("comments(")) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
          path: ["post", "comments"],
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
      };
    }
    return { data: { post: { id: "post-1" } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query Post($uri: ID!) {
        post(id: $uri, idType: URI) {
          id
          language { code }
          comments(first: 100) { nodes { id } }
        }
      }
    `,
    { uri: "/hello-world/" },
    POST_GRAPHQL_COMPATIBILITY_RULES,
  );

  assert.deepEqual(response.data, { post: { id: "post-1" } });
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\bcomments\s*\(/);
  assert.match(requestedQueries[1], /\blanguage\s*\{/);
});

test("blog fallback drops only a malformed top-level comments connection", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("comments(")) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
          path: ["comments"],
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
      };
    }
    return { data: { posts: { nodes: [] } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query Blog {
        posts(first: 20) { nodes { id title } }
        comments(first: 20) { nodes { id } }
      }
    `,
    {},
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  assert.deepEqual(response.data, { posts: { nodes: [] } });
  assert.equal(requestedQueries.length, 2);
  assert.match(requestedQueries[1], /\bposts\s*\(/);
  assert.doesNotMatch(requestedQueries[1], /\bcomments\s*\(/);
});

test("blog fallback preserves approved comments when an optional avatar is null", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("avatar(")) {
      return {
        data: null,
        errors: [{
          message: "Cannot return null for non-nullable field Avatar.url.",
          path: ["posts", "nodes", 0, "author", "node", "avatar", "url"],
        }],
      };
    }
    return {
      data: {
        posts: { nodes: [] },
        comments: { nodes: [{ id: "comment-1" }] },
      } as T,
    };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    `
      query Blog {
        posts(first: 20) {
          nodes {
            id
            author {
              node {
                name
                avatar(size: 96) {
                  url
                }
              }
            }
          }
        }
        comments(first: 20) { nodes { id } }
      }
    `,
    {},
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  assert.deepEqual(response.data, {
    posts: { nodes: [] },
    comments: { nodes: [{ id: "comment-1" }] },
  });
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\bavatar\s*\(/);
  assert.match(requestedQueries[1], /\bcomments\s*\(/);
});

test("free-profile core queries omit slow optional fields without dropping rendered content", () => {
  const page = createCorePageQuery(`
    query Page {
      page {
        title
        content
        template { templateName }
        language { code }
        translations { uri language { code } }
        enqueuedScripts { nodes { id } }
        seo { title }
        themeStyles { customCss }
      }
    }
  `);
  assert.doesNotMatch(page, /\btemplate\s*\{|\blanguage\s*\{|\btranslations\s*\{|\benqueuedScripts\s*\{|\bseo\s*\{|\bthemeStyles\s*\{/);
  assert.match(page, /\btitle\b|\bcontent\b/);

  const post = createCorePostQuery(`
    query Post {
      post {
        title
        content
        language { code }
        translations { uri }
        comments(first: 100, where: { statusIn: [APPROVE] }) {
          nodes {
            id
            author { node { name } }
          }
        }
        enqueuedScripts { nodes { id } }
        seo { title }
        themeStyles { customCss }
      }
    }
  `);
  assert.doesNotMatch(post, /\blanguage\s*\{|\btranslations\s*\{|\benqueuedScripts\s*\{|\bseo\s*\{|\bthemeStyles\s*\{/);
  assert.match(post, /\btitle\b|\bcontent\b|\bcomments\s*\(first: 100, where: \{ statusIn: \[APPROVE\] \}\)|\bauthor\s*\{/);

  const listing = createCoreBlogQuery(`
    query Blog($language: LanguageCodeFilterEnum!) {
      posts(where: { status: PUBLISH, language: $language }) {
        nodes {
          title
          excerpt
          content(format: RENDERED)
          language { code }
          seo { readingTime }
        }
      }
      comments { nodes { id } }
    }
  `);
  assert.doesNotMatch(listing, /LanguageCodeFilterEnum|\$language|status:\s*PUBLISH|\bcontent\s*\(|\blanguage\s*\{|\bseo\s*\{|\bcomments\s*\{/);
  assert.match(listing, /\bposts\s*\(|\btitle\b|\bexcerpt\b/);

  const archive = createCorePostArchiveQuery(`
    query Archive {
      category {
        name
        translations {
          uri
          language { code }
        }
        posts {
          nodes {
            title
            content
          }
        }
        enqueuedScripts { nodes { id } }
        seo { title }
      }
    }
  `);
  assert.doesNotMatch(archive, /\bcontent\b|\benqueuedScripts\s*\{|\bseo\s*\{|\blanguage\s*\{/);
  assert.match(archive, /\bcategory\s*\{|\bname\b|\btranslations\s*\{|\bposts\s*\{/);
});

test("language-resolver fallback keeps translation identities and distinct slugs", () => {
  const page = createLanguageCompatiblePageQuery(`
    query Page {
      page {
        databaseId
        uri
        template { templateName }
        language { code }
        translations {
          databaseId
          uri
          language { code }
        }
        enqueuedScripts { nodes { id } }
        seo { title }
        themeStyles { customCss }
      }
    }
  `);

  assert.doesNotMatch(page, /\btemplate\s*\{|\blanguage\s*\{|\benqueuedScripts\s*\{|\bseo\s*\{|\bthemeStyles\s*\{/);
  assert.match(page, /\btranslations\s*\{\s*databaseId\s+uri\s*\}/);
});

test("route registry fallback removes broken status and language resolvers together", () => {
  const compatible = createCoreRouteRegistryQuery(`
    query Routes {
      pages(where: { status: PUBLISH }, first: 100) {
        nodes {
          uri
          language {
            code
          }
          headlessShortcodes
        }
      }
    }
  `);

  assert.doesNotMatch(compatible, /status:\s*PUBLISH|\blanguage\s*\{/);
  assert.match(compatible, /\bpages\(first: 100\)|\bheadlessShortcodes\b/);
});

test("only the full backend profile starts with rich GraphQL documents", () => {
  assert.equal(shouldPreferCoreGraphqlQueries("shell"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("blog"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("shop"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("full"), false);
});

test("free blog profile retains multilingual content without enabling it for shop", () => {
  assert.equal(shouldPreferCoreContentQueries("shell"), true);
  assert.equal(shouldPreferCoreContentQueries("blog"), false);
  assert.equal(shouldPreferCoreContentQueries("shop"), true);
  assert.equal(shouldPreferCoreContentQueries("full"), false);
});

test("free blog content infers locales from translation URIs without broken language resolvers", () => {
  const query = `
    query Content {
      page {
        language { code }
        translations { id }
        themeStyles { globalStyles }
      }
    }
  `;

  for (const optimized of [
    createProfilePageQuery(query, "blog"),
    createProfilePostQuery(query, "blog"),
  ]) {
    assert.match(optimized, /translations\s*\{\s*id\s*\}/);
    assert.doesNotMatch(optimized, /\blanguage\s*\{|\bthemeStyles\b/);
  }
  assert.match(createProfilePageQuery(query, "full"), /themeStyles/);
});

test("free blog compatibility fallback separates prefixed and default-language routes", () => {
  const nodes = [
    { uri: "/english-story/", language: { code: "EN" } },
    { uri: "/ja/japanese-story/", language: { code: "JA" } },
  ];
  assert.deepEqual(filterLocalizedBlogNodes(nodes, "ja"), [nodes[1]]);

  const fallbackNodes = [
    { uri: "/polish-story/" },
    { uri: "/en/english-story/" },
    { uri: "/ja/japanese-story/" },
  ];
  assert.deepEqual(filterLocalizedBlogNodes(fallbackNodes, "pl"), [fallbackNodes[0]]);
  assert.deepEqual(filterLocalizedBlogNodes(fallbackNodes, "en"), [fallbackNodes[1]]);
  assert.deepEqual(filterLocalizedBlogNodes(fallbackNodes, "ja"), [fallbackNodes[2]]);
});
