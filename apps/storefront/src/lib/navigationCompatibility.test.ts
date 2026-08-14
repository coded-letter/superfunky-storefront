import assert from "node:assert/strict";
import test from "node:test";

import { hasOnlyKnownNavigationResolverErrors } from "./navigationCompatibility.ts";

test("recognizes the Polylang resolver defect that requires compatible navigation", () => {
  assert.equal(
    hasOnlyKnownNavigationResolverErrors([
      {
        message: "Internal server error",
        extensions: { debugMessage: "Cannot access offset of type string on string" },
      },
    ]),
    true,
  );
});

test("does not hide unrelated navigation failures", () => {
  assert.equal(
    hasOnlyKnownNavigationResolverErrors([
      {
        message: "Internal server error",
        extensions: { debugMessage: "WordPress database unavailable" },
      },
    ]),
    false,
  );
  assert.equal(hasOnlyKnownNavigationResolverErrors(undefined), false);
});
