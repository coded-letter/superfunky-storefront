import assert from "node:assert/strict";
import test from "node:test";
import { oauthStateFromAuthorizationUrl, parseStorefrontAuthRef, withStorefrontAuthRef } from "./authRef.ts";

test("accepts strict storefront-relative refs", () => {
  assert.equal(parseStorefrontAuthRef("/checkout?step=payment#card"), "/checkout?step=payment#card");
  assert.equal(parseStorefrontAuthRef("/pl/moje-konto"), "/pl/moje-konto");
  assert.equal(parseStorefrontAuthRef("/products/coffee%20maker?variant=red%2Fblue"), "/products/coffee%20maker?variant=red%2Fblue");
});

test("rejects external, malformed, control-character, and auth-loop refs", () => {
  for (const ref of [
    "https://evil.example/",
    "//evil.example/",
    "/%2fevil.example/",
    "/\\evil.example/",
    "/%5cevil.example/",
    "checkout",
    "/checkout\n/evil",
    "/checkout%0aevil",
    "/auth",
    "/auth/register?ref=%2Fcheckout",
    "/%61uth/register",
    "/pl/auth/forgot-password",
    "/oauth/login/google",
  ]) {
    assert.equal(parseStorefrontAuthRef(ref), null, ref);
  }
});

test("propagates refs without corrupting existing queries", () => {
  assert.equal(withStorefrontAuthRef("/auth", "/checkout?a=1"), "/auth?ref=%2Fcheckout%3Fa%3D1");
  assert.equal(withStorefrontAuthRef("/auth?password-reset=success", "/cart"), "/auth?password-reset=success&ref=%2Fcart");
});

test("reads the provider state used to correlate an OAuth callback", () => {
  assert.equal(oauthStateFromAuthorizationUrl("https://id.example/login?state=csrf-token"), "csrf-token");
  assert.equal(oauthStateFromAuthorizationUrl("not a url"), null);
});

test("stores refs under OAuth state and consumes each value once", async () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  const { consumeOAuthAuthRef, storeOAuthAuthRef } = await import("./authRef.ts");
  storeOAuthAuthRef("csrf", "/checkout");
  assert.equal(consumeOAuthAuthRef("csrf"), "/checkout");
  assert.equal(consumeOAuthAuthRef("csrf"), null);
  delete (globalThis as { window?: unknown }).window;
});
