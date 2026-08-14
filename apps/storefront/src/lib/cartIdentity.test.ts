import assert from "node:assert/strict";
import test from "node:test";
import { backendItemMatches } from "./cartIdentity.ts";

test("matches core Store API simple products by item.id", () => {
  assert.equal(backendItemMatches({ id: 2771 }, 2771, null), true);
  assert.equal(backendItemMatches({ id: 2771 }, 2772, null), false);
});

test("matches core Store API variations by the purchasable variation id", () => {
  assert.equal(backendItemMatches({ id: 3101 }, 3000, 3101), true);
  assert.equal(backendItemMatches({ id: 3000 }, 3000, 3101), false);
});

test("supports extensions that expose parent and variation ids", () => {
  assert.equal(
    backendItemMatches(
      { id: 3000, product_id: 3000, variation_id: 3101 },
      3000,
      3101,
    ),
    true,
  );
});
