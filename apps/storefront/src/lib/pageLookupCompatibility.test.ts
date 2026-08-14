import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompatiblePageLookupQuery,
  selectPageLookupCandidate,
} from "./pageLookupCompatibility.ts";

test("page lookup fallback removes the malformed pages where filter", () => {
  const query = `
    query PageByName($name: String!) {
      pages(first: 10, where: { name: $name, status: PUBLISH }) {
        nodes { slug uri }
      }
    }
  `;

  const compatible = createCompatiblePageLookupQuery(query);
  assert.doesNotMatch(compatible, /\$name|\bwhere\s*:/);
  assert.match(compatible, /pages\(first: 10\)/);
});

test("page lookup accepts a matching slug when the posts page has no URI", () => {
  const candidates = [
    { databaseId: 1, slug: "account", uri: "/account/" },
    { databaseId: 2, slug: "blog", uri: null },
  ];

  assert.deepEqual(
    selectPageLookupCandidate(candidates, "/blog/", "blog"),
    candidates[1],
  );
});
