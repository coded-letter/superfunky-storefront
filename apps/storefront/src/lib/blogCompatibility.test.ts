import assert from "node:assert/strict";
import test from "node:test";

import { BLOG_DATA_COMPATIBILITY_RULES, createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { requestGraphqlWithCompatibility, type GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";
import { createCompatiblePostArchiveQuery } from "./postArchiveGraphqlCompatibility.ts";
import { createCompatibleAuthorArchiveQuery } from "./authorArchiveGraphqlCompatibility.ts";
import { POST_GRAPHQL_COMPATIBILITY_RULES } from "./postGraphqlCompatibility.ts";
import {
  createCoreBlogQuery,
  createCorePageQuery,
  createCorePostArchiveQuery,
  createCorePostQuery,
  shouldPreferCoreGraphqlQueries,
} from "./profileGraphqlCompatibility.ts";

test("blog fallback removes Polylang requirements while preserving posts and SEO", () => {
  const query = `
    query Blog($language: LanguageCodeFilterEnum!) {
      posts(first: 100, where: { language: $language }) {
        nodes {
          title
          language { code }
          translations { uri language { code } }
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
        errors: [{
          message: "Internal server error",
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
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
  assert.doesNotMatch(requestedQueries[1], /categories\([^)]*\bwhere:|\bcomments\s*\(/);
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
      categories {
        nodes {
          name
        }
      }
    }
  `);

  assert.doesNotMatch(compatible, /\bcontent\s*\(|\bseo\s*\{|\benqueuedScripts\s*\{/);
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

test("post fallback isolates malformed comments and Polylang resolvers", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("comments(") || query.includes("language {")) {
      return {
        data: null,
        errors: [{
          message: "Internal server error",
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
  assert.deepEqual(response.data, { post: { id: "post-1" } });
  assert.equal(requestedQueries.length, 2);
  assert.doesNotMatch(requestedQueries[1], /\blanguage\s*\{|\btranslations\s*\{|\bcomments\s*\(/);
  assert.match(requestedQueries[1], /\bseo\s*\{/);
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
        comments { nodes { id } }
        enqueuedScripts { nodes { id } }
        seo { title }
        themeStyles { customCss }
      }
    }
  `);
  assert.doesNotMatch(post, /\blanguage\s*\{|\btranslations\s*\{|\bcomments\s*\{|\benqueuedScripts\s*\{|\bseo\s*\{|\bthemeStyles\s*\{/);
  assert.match(post, /\btitle\b|\bcontent\b/);

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
  assert.doesNotMatch(archive, /\bcontent\b|\benqueuedScripts\s*\{|\bseo\s*\{/);
  assert.match(archive, /\bcategory\s*\{|\bname\b|\bposts\s*\{/);
});

test("only the full backend profile starts with rich GraphQL documents", () => {
  assert.equal(shouldPreferCoreGraphqlQueries("shell"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("blog"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("shop"), true);
  assert.equal(shouldPreferCoreGraphqlQueries("full"), false);
});
