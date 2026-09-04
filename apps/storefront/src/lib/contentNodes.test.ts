import assert from "node:assert/strict";
import test from "node:test";

import { getContentNodeInfo } from "./contentNodes.ts";
import type { GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";

test("content-node lookup recovers clean post permalinks from the malformed nodeByUri resolver", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string, variables) => {
    requestedQueries.push(query);
    assert.deepEqual(variables, { uri: "/clean-post/" });
    if (query.includes("nodeByUri")) {
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

  assert.deepEqual(await getContentNodeInfo("/clean-post/", request), { type: "Post" });
  assert.equal(requestedQueries.length, 2);
  assert.match(requestedQueries[1], /post\(id:\s*\$uri,\s*idType:\s*URI\)/);
});

test("content-node post fallback returns null for an unknown clean permalink", async () => {
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => query.includes("nodeByUri")
    ? {
        data: null,
        errors: [{
          message: "Internal server error",
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
      }
    : { data: { post: null } as T };

  assert.equal(await getContentNodeInfo("/missing/", request), null);
});

test("content-node lookup preserves unrelated GraphQL failures", async () => {
  let requestCount = 0;
  const request: GraphqlFieldFallbackRequester = async () => {
    requestCount += 1;
    return {
      data: null,
      errors: [{ message: "Database connection failed" }],
    };
  };

  await assert.rejects(getContentNodeInfo("/clean-post/", request), /Database connection failed/);
  assert.equal(requestCount, 1);
});

test("content-node lookup preserves errors from the post fallback", async () => {
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => query.includes("nodeByUri")
    ? {
        data: null,
        errors: [{
          message: "Internal server error",
          extensions: { debugMessage: "Cannot access offset of type string on string" },
        }],
      }
    : {
        data: null,
        errors: [{ message: "Post lookup failed" }],
      };

  await assert.rejects(getContentNodeInfo("/clean-post/", request), /Post lookup failed/);
});

test("free profiles probe root-level post and page schemas in priority order", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    return query.includes("post(")
      ? { data: { post: { id: "post-1" } } as T }
      : { data: { page: null } as T };
  };

  assert.deepEqual(await getContentNodeInfo("/clean-post/", request, "blog"), { type: "Post" });
  assert.equal(requestedQueries.length, 1);
  assert.match(requestedQueries[0], /post\(id:\s*\$uri,\s*idType:\s*URI\)/);
});

test("free-profile post probe still classifies a root-level page", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("post(")) return { data: { post: null } as T };
    if (query.includes("page(")) return { data: { page: { id: "page-1" } } as T };
    return { data: { nodeByUri: { __typename: "Page" } } as T };
  };

  assert.deepEqual(await getContentNodeInfo("/sample-page/", request, "shop"), { type: "Page" });
  assert.equal(requestedQueries.length, 2);
  assert.match(requestedQueries[0], /post\(/);
  assert.match(requestedQueries[1], /page\(/);
});

test("concurrent page callers can skip the duplicate page probe", async () => {
  const requestedQueries: string[] = [];
  const request: GraphqlFieldFallbackRequester = async <T>(query: string) => {
    requestedQueries.push(query);
    if (query.includes("nodeByUri")) {
      return { data: { nodeByUri: { __typename: "ProductCategory" } } as T };
    }
    return { data: { post: null } as T };
  };

  assert.deepEqual(
    await getContentNodeInfo("/sale/", request, "shop", { probePage: false }),
    { type: "ProductCategory" },
  );
  assert.equal(requestedQueries.length, 2);
  assert.match(requestedQueries[0], /post\(/);
  assert.match(requestedQueries[1], /nodeByUri/);
});
