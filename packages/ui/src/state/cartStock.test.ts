import assert from "node:assert/strict";
import test from "node:test";
import { clampCartQuantity } from "./cartStock.ts";

test("caps quantities at managed stock when backorders are disallowed", () => {
  assert.equal(clampCartQuantity(5, { stockQuantity: 3, backordersAllowed: false }), 3);
  assert.equal(clampCartQuantity(1, { stockQuantity: 0, backordersAllowed: false }), 0);
});

test("does not cap quantities when backorders are allowed or stock is unknown", () => {
  assert.equal(clampCartQuantity(5, { stockQuantity: 3, backordersAllowed: true }), 5);
  assert.equal(clampCartQuantity(5, { stockQuantity: null, backordersAllowed: false }), 5);
});
