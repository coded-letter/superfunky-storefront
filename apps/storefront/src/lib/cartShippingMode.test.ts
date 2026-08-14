import assert from "node:assert/strict";
import test from "node:test";
import { isDigitalOnlyCart } from "./cartShippingMode.ts";

test("uses WooCommerce needs_shipping for a virtual-only cart", () => {
  assert.equal(isDigitalOnlyCart({ items: [{}], needs_shipping: false }, [{ virtual: false }]), true);
});

test("keeps shipping for mixed and physical downloadable carts", () => {
  assert.equal(isDigitalOnlyCart({ items: [{}, {}], needs_shipping: true }, [{ virtual: true }, { virtual: true }]), false);
});

test("falls back to local virtual metadata before backend hydration", () => {
  assert.equal(isDigitalOnlyCart(null, [{ virtual: true }, { virtual: true }]), true);
  assert.equal(isDigitalOnlyCart(null, [{ virtual: true }, { virtual: false }]), false);
  assert.equal(isDigitalOnlyCart(null, []), false);
});
