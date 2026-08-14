import assert from "node:assert/strict";
import test from "node:test";

import {
  missingGraphqlFieldRule,
  removeGraphqlFieldSelections,
  requestGraphqlWithCompatibility,
  type GraphqlFieldFallbackRequester,
} from "./graphqlFieldFallback.ts";

const BLOG_QUERY = /* GraphQL */ `
  query BlogPost {
    post {
      title
      language {
        code
      }
      translations {
        uri
        language { code }
      }
      seo {
        title
      }
    }
  }
`;

test("field removal drops every nested Polylang selection without touching core content", () => {
  const compatibleQuery = removeGraphqlFieldSelections(BLOG_QUERY, "language");

  assert.doesNotMatch(compatibleQuery, /\blanguage\s*\{/);
  assert.match(compatibleQuery, /\btranslations\s*\{/);
  assert.match(compatibleQuery, /\btitle\b/);
  assert.match(compatibleQuery, /\bseo\s*\{/);
});

test("field removal drops selections with multiline arguments as one unit", () => {
  const query = `
    query Comments {
      comments(
        first: 20
        where: {
          statusIn: [APPROVE]
        }
      ) {
        nodes {
          id
        }
      }
      posts(first: 10) {
        nodes {
          title
        }
      }
    }
  `;

  const compatibleQuery = removeGraphqlFieldSelections(query, "comments");
  assert.doesNotMatch(compatibleQuery, /\bcomments\b|first:\s*20|statusIn/);
  assert.match(compatibleQuery, /\bposts\(first: 10\)/);
});

for (const scenario of [
  { name: "no Polylang and no SEO", polylang: false, seo: false },
  { name: "Polylang without SEO", polylang: true, seo: false },
  { name: "Polylang with SEO", polylang: true, seo: true },
] as const) {
  test(`blog compatibility supports ${scenario.name}`, async () => {
    const requestedQueries: string[] = [];
    const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
      requestedQueries.push(query);
      const errors = [
        ...(!scenario.polylang && /\blanguage\s*\{/.test(query)
          ? [{ message: 'Cannot query field "language" on type "Post".' }]
          : []),
        ...(!scenario.polylang && /\btranslations\s*\{/.test(query)
          ? [{ message: 'Cannot query field "translations" on type "Post".' }]
          : []),
        ...(!scenario.seo && /\bseo\s*\{/.test(query)
          ? [{ message: 'Cannot query field "seo" on type "Post".' }]
          : []),
      ];
      return errors.length
        ? { data: null, errors }
        : { data: { post: { title: "Hello" } } as T };
    };

    const response = await requestGraphqlWithCompatibility(
      request,
      BLOG_QUERY,
      {},
      [
        missingGraphqlFieldRule("language"),
        missingGraphqlFieldRule("translations"),
        missingGraphqlFieldRule("seo"),
      ],
    );

    assert.deepEqual(response.data, { post: { title: "Hello" } });
    const finalQuery = requestedQueries[requestedQueries.length - 1] || "";
    assert.equal(/\blanguage\s*\{/.test(finalQuery), scenario.polylang);
    assert.equal(/\btranslations\s*\{/.test(finalQuery), scenario.polylang);
    assert.equal(/\bseo\s*\{/.test(finalQuery), scenario.seo);
  });
}

test("minimal shell compatibility removes absent optional fields and propagates unrelated failures", async () => {
  let calls = 0;
  const request: GraphqlFieldFallbackRequester = async <T>() => {
    calls += 1;
    return {
      data: { post: null } as T,
      errors: [{ message: "WordPress database unavailable" }],
    };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    BLOG_QUERY,
    {},
    [
      missingGraphqlFieldRule("language"),
      missingGraphqlFieldRule("translations"),
      missingGraphqlFieldRule("seo"),
    ],
  );

  assert.equal(calls, 1);
  assert.deepEqual(response.errors, [{ message: "WordPress database unavailable" }]);
});

test("compatibility rules can narrowly match resolver debug messages", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    return query.includes("template")
      ? {
          data: null,
          errors: [{
            message: "Internal server error",
            extensions: { debugMessage: "Cannot access offset of type string on string" },
          }],
        }
      : { data: { page: { title: "Home" } } as T };
  };

  const response = await requestGraphqlWithCompatibility(
    request,
    "query Page { page { title template { templateName } } }",
    {},
    [{
      matches: (message) => message === "Cannot access offset of type string on string",
      transform: (query) => query.replace("template { templateName }", ""),
    }],
  );

  assert.deepEqual(response.data, { page: { title: "Home" } });
  assert.equal(requestedQueries.length, 2);
});
