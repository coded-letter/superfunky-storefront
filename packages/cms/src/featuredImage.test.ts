import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeFeaturedImage } from "./featuredImage.ts";

const developerTipsPayload = JSON.parse(
  readFileSync(new URL("./fixtures/developerTipsFeaturedImage.json", import.meta.url), "utf8"),
);

test("uses the exact Developer tips SEO ImageObject when its featuredImage edge is null", () => {
  assert.deepEqual(
    normalizeFeaturedImage(developerTipsPayload.featuredImage, developerTipsPayload.seo.schema),
    {
      sourceUrl: "https://v3.superfunky.pro/wp-content/uploads/2025/02/david-pupaza-heNwUmEtZzo-unsplash-e1785794485108.jpg",
      altText: "",
      width: 1192,
      height: 784,
    },
  );
});

test("prefers a normal featuredImage node and preserves responsive metadata", () => {
  assert.deepEqual(
    normalizeFeaturedImage(
      {
        node: {
          sourceUrl: "https://cms.example/uploads/working.jpg",
          altText: "Working featured image",
          srcSet: "https://cms.example/uploads/working-600.jpg 600w, https://cms.example/uploads/working.jpg 1200w",
          mediaDetails: { width: 1200, height: 800 },
        },
      },
      {
        raw: JSON.stringify({
          "@graph": [{ "@type": "ImageObject", contentUrl: "https://cms.example/uploads/fallback.jpg" }],
        }),
      },
    ),
    {
      sourceUrl: "https://cms.example/uploads/working.jpg",
      altText: "Working featured image",
      srcSet: "https://cms.example/uploads/working-600.jpg 600w, https://cms.example/uploads/working.jpg 1200w",
      width: 1200,
      height: 800,
    },
  );
});

test("rejects malformed schema and non-http image URLs", () => {
  assert.equal(normalizeFeaturedImage(null, { raw: "{" }), null);
  assert.equal(
    normalizeFeaturedImage(null, {
      raw: JSON.stringify({ "@graph": [{ "@type": "ImageObject", contentUrl: "javascript:alert(1)" }] }),
    }),
    null,
  );
});
