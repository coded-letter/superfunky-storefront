import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompatiblePageLookupQuery,
  normalizePageLookupUri,
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
  assert.match(compatible, /pages\(first: 100\)/);
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

test("localized page lookup does not fall back to another locale by slug", () => {
  const candidates = [
    { databaseId: 1, slug: "blog", uri: "/blog/" },
    { databaseId: 2, slug: "journeys", uri: "/en/journeys/" },
  ];

  assert.equal(
    selectPageLookupCandidate(candidates, "/ja/blog/", "blog", true),
    null,
  );
});

test("page lookup normalizes encoded Unicode routes before exact matching", () => {
  const normalized = normalizePageLookupUri("/ja/%E3%82%B8%E3%83%A3%E3%83%BC%E3%83%8A%E3%83%AB");
  assert.equal(normalized, "/ja/ジャーナル/");
  assert.deepEqual(
    selectPageLookupCandidate(
      [{ databaseId: 1, slug: "ジャーナル", uri: "/ja/ジャーナル/" }],
      normalized,
      "ジャーナル",
      true,
    ),
    { databaseId: 1, slug: "ジャーナル", uri: "/ja/ジャーナル/" },
  );
});
