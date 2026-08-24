import assert from "node:assert/strict";
import test from "node:test";
import {
  hasOnlyLoginPayloadCompatibilityErrors,
  omitUnsupportedLoginPayloadFields,
} from "./authGraphqlCompatibility.ts";

test("recognizes optional WooCommerce login payload fields", () => {
  assert.equal(hasOnlyLoginPayloadCompatibilityErrors([
    { message: 'Cannot query field "sessionToken" on type "LoginPayload".' },
    { message: 'Cannot query field "cartToken" on type "LoginPayload". Did you mean "authToken"?' },
    { message: 'Cannot query field "customer" on type "LoginPayload". Did you mean "user"?' },
  ]), true);
});

test("does not mask login failures or unrelated schema errors", () => {
  assert.equal(hasOnlyLoginPayloadCompatibilityErrors([
    { message: "Invalid credentials" },
  ]), false);
  assert.equal(hasOnlyLoginPayloadCompatibilityErrors([
    { message: 'Cannot query field "refreshToken" on type "LoginPayload".' },
  ]), false);
  assert.equal(hasOnlyLoginPayloadCompatibilityErrors([]), false);
  assert.equal(hasOnlyLoginPayloadCompatibilityErrors(undefined), false);
});

test("removes only fields unsupported by a particular backend", () => {
  const query = `
    login {
      authToken
      sessionToken
      cartToken
      customer {
        databaseId
        email
      }
      user {
        databaseId
      }
    }
  `;
  const compatible = omitUnsupportedLoginPayloadFields(query, [
    { message: 'Cannot query field "cartToken" on type "LoginPayload". Did you mean "authToken"?' },
  ]);
  assert.ok(compatible);
  assert.match(compatible, /sessionToken/);
  assert.match(compatible, /customer\s*\{/);
  assert.match(compatible, /user\s*\{/);
  assert.doesNotMatch(compatible, /cartToken/);
  assert.equal(omitUnsupportedLoginPayloadFields(query, [{ message: "Invalid credentials" }]), null);

  const coreOnly = omitUnsupportedLoginPayloadFields(query, [
    { message: 'Cannot query field "sessionToken" on type "LoginPayload".' },
    { message: 'Cannot query field "cartToken" on type "LoginPayload". Did you mean "authToken"?' },
    { message: 'Cannot query field "customer" on type "LoginPayload". Did you mean "user"?' },
  ]);
  assert.ok(coreOnly);
  assert.doesNotMatch(coreOnly, /sessionToken|cartToken|customer\s*\{/);
  assert.match(coreOnly, /user\s*\{/);
});
