import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productCard = readFileSync(new URL("./ProductCard.tsx", import.meta.url), "utf8");
const productGallery = readFileSync(new URL("./ProductGallery.tsx", import.meta.url), "utf8");
const productImageLightbox = readFileSync(new URL("./ProductImageLightbox.tsx", import.meta.url), "utf8");

test("product card galleries scroll fixed square thumbnails without compressing them", () => {
  assert.match(productCard, /snap-x snap-mandatory gap-1\.5 overflow-x-auto overscroll-x-contain/);
  assert.match(productCard, /h-12 w-12 shrink-0 snap-start/);
  assert.match(productCard, /sizes="3rem" className="block !h-full !w-full object-cover"/);
});

test("product gallery and lightbox preserve full image aspect ratios", () => {
  assert.match(productGallery, /className="block h-full w-full object-contain"/);
  assert.match(productImageLightbox, /max-h-\[75vh\] max-w-full select-none/);
  assert.match(productImageLightbox, /className="block h-auto max-h-\[75vh\] w-auto max-w-full object-contain"/);
  assert.doesNotMatch(productImageLightbox, /grid aspect-square w-full select-none/);
});
