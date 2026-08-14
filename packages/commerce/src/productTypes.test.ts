import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommerceProductType } from "./productTypes.ts";

test("maps every WooCommerce product typename used by storefront cards", () => {
  assert.equal(resolveCommerceProductType("SimpleProduct"), "simple");
  assert.equal(resolveCommerceProductType("VariableProduct"), "variable");
  assert.equal(resolveCommerceProductType("ExternalProduct"), "external");
  assert.equal(resolveCommerceProductType("GroupProduct"), "grouped");
});
