import assert from "node:assert/strict";
import test from "node:test";
import { policyAllowsEditorCode, withStorefrontEditorPolicy } from "./security-policy.mjs";

const CURRENT_POLICY = "default-src 'self' https: data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";

test("adds split inline-style directives and a compatibility fallback without changing other directives", () => {
  const policy = withStorefrontEditorPolicy(CURRENT_POLICY, "https://v3.superfunky.pro/graphql");

  assert.equal(
    policy,
    "default-src 'self' https: data: blob:; "
      + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; "
      + "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; "
      + "script-src-attr 'none'; "
      + "style-src 'self' 'unsafe-inline' https://v3.superfunky.pro; "
      + "style-src-elem 'self' 'unsafe-inline' https://v3.superfunky.pro; "
      + "style-src-attr 'unsafe-inline'; "
      + "connect-src 'self' https: wss:; "
      + "frame-src 'self' https:; "
      + "worker-src 'self' https: blob:; "
      + "object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  );
  assert.equal(policyAllowsEditorCode(policy), true);
});

test("preserves merchant script sources while enabling Custom HTML JavaScript", () => {
  const input = "default-src 'none'; script-src 'self' https://js.stripe.com; style-src https:; object-src 'none'";
  const policy = withStorefrontEditorPolicy(input, "http://insecure.example/graphql");

  assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: https:\/\/js\.stripe\.com/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /connect-src 'self' https: wss:/);
  assert.doesNotMatch(policy, /style-src[^;]*(?:^|\s)https:(?:\s|;)/);
  assert.equal(policyAllowsEditorCode(policy), true);
});
