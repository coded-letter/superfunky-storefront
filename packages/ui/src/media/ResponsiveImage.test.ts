import assert from "node:assert/strict";
import test from "node:test";
import { normalizeManagedMediaUrl } from "./ResponsiveImage.urls.ts";

test("upgrades managed WordPress media to HTTPS before edge optimization", () => {
  assert.equal(
    normalizeManagedMediaUrl("http://dev.superfunky.pro/wp-content/uploads/example.jpg"),
    "https://dev.superfunky.pro/wp-content/uploads/example.jpg",
  );
  assert.equal(
    normalizeManagedMediaUrl("http://unrelated.example/image.jpg"),
    "http://unrelated.example/image.jpg",
  );
});
