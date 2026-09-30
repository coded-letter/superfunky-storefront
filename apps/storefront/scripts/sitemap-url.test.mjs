import assert from "node:assert/strict";
import test from "node:test";
import { sitemapUrl } from "./sitemap-url.mjs";

test("sitemap locations end with one slash, including the storefront root", () => {
  assert.equal(sitemapUrl("https://shop.example.test", "/"), "https://shop.example.test/");
  assert.equal(sitemapUrl("https://shop.example.test", "/shop/item"), "https://shop.example.test/shop/item/");
  assert.equal(sitemapUrl("https://shop.example.test", "/shop/item///"), "https://shop.example.test/shop/item/");
});

test("sitemap locations reject external routes and strip fragments", () => {
  assert.throws(() => sitemapUrl("https://shop.example.test", "https://outside.example/test"));
  assert.equal(
    sitemapUrl("https://shop.example.test", "/shop/item#details"),
    "https://shop.example.test/shop/item/",
  );
});
