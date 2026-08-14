import assert from "node:assert/strict";
import test from "node:test";
import { buildStoreApiHeaders, isStoreApiNonceError } from "./storeApiAuth.ts";

test("authenticates logged-in Store API requests while preserving the cart token", () => {
  assert.deepEqual(
    buildStoreApiHeaders({
      authToken: "signed-user-token",
      cartToken: "cart-token",
      nonce: "unused-nonce",
      isStateChanging: true,
    }),
    {
      "Content-Type": "application/json",
      Authorization: "Bearer signed-user-token",
      "X-WPGraphQL-Login-Token": "signed-user-token",
      "Cart-Token": "cart-token",
    },
  );
});

test("does not duplicate the Bearer prefix", () => {
  const headers = buildStoreApiHeaders({
    authToken: "Bearer signed-user-token",
    cartToken: null,
    nonce: "checkout-nonce",
    isStateChanging: true,
  });

  assert.equal(headers.Authorization, "Bearer signed-user-token");
  assert.equal(headers["X-WPGraphQL-Login-Token"], "signed-user-token");
  assert.equal(headers.Nonce, "checkout-nonce");
});

test("keeps guest Store API reads unauthenticated", () => {
  assert.deepEqual(
    buildStoreApiHeaders({
      authToken: null,
      cartToken: null,
      nonce: "read-nonce",
      isStateChanging: false,
    }),
    {
      "Content-Type": "application/json",
    },
  );
});

test("recognizes nonce failures that require a fresh Store API session", () => {
  assert.equal(isStoreApiNonceError("Missing the Nonce header. This endpoint requires a valid nonce."), true);
  assert.equal(isStoreApiNonceError("Coupon code is invalid."), false);
});
