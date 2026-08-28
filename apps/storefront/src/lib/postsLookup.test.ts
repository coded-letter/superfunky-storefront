import assert from "node:assert/strict";
import test from "node:test";

import { postSlugFromUri, requestPostWithSlugFallback } from "./postLookup.ts";

test("post lookup falls back to a permalink-independent slug when the URI is missing", async () => {
  const requests: Array<{ identifier: string; idType: "URI" | "SLUG" }> = [];
  const request = async (identifier: string, idType: "URI" | "SLUG") => {
    requests.push({ identifier, idType });
    return idType === "URI"
      ? { data: { post: null } }
      : { data: { post: { id: "post-233" } } };
  };

  const response = await requestPostWithSlugFallback(
    "/optyk-lubin-zaprasza-na-badanie-wzroku-na-ulice-wiazowa-po-okulary-led/",
    request,
    (result) => result.data.post === null,
  );

  assert.deepEqual(response.data, { post: { id: "post-233" } });
  assert.deepEqual(requests, [
    {
      identifier: "/optyk-lubin-zaprasza-na-badanie-wzroku-na-ulice-wiazowa-po-okulary-led/",
      idType: "URI",
    },
    {
      identifier: "optyk-lubin-zaprasza-na-badanie-wzroku-na-ulice-wiazowa-po-okulary-led",
      idType: "SLUG",
    },
  ]);
});

test("post lookup does not issue a slug request when the URI resolves", async () => {
  let requests = 0;
  const request = async () => {
    requests += 1;
    return { data: { post: { id: "post-1" } } };
  };

  const response = await requestPostWithSlugFallback(
    "/post/",
    request,
    (result) => result.data.post === null,
  );

  assert.deepEqual(response.data, { post: { id: "post-1" } });
  assert.equal(requests, 1);
});

test("post slug extraction handles date paths, encoded slugs, and empty URIs", () => {
  assert.equal(postSlugFromUri("/2026/08/12/hello-world/"), "hello-world");
  assert.equal(postSlugFromUri("/blog/za%C5%BC%C3%B3%C5%82%C4%87/?preview=true"), "zażółć");
  assert.equal(postSlugFromUri("/"), null);
});
