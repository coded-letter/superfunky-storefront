import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productCard = readFileSync(new URL("./ProductCard.tsx", import.meta.url), "utf8");

test("product card galleries scroll fixed square thumbnails without compressing them", () => {
  assert.match(productCard, /snap-x snap-mandatory gap-1\.5 overflow-x-auto overscroll-x-contain/);
  assert.match(productCard, /h-12 w-12 shrink-0 snap-start/);
  assert.match(productCard, /sizes="3rem" className="block !h-full !w-full object-cover"/);
});
