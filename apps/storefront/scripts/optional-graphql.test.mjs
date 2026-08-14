import assert from "node:assert/strict";
import test from "node:test";

import { hasOnlyMissingField, hasOnlyMissingRootField } from "./optional-graphql.mjs";

test("recognizes only the requested optional RootQuery field", () => {
  assert.equal(
    hasOnlyMissingRootField(
      [{ message: 'Cannot query field "funkycommerceStaticGenerationConfig" on type "RootQuery".' }],
      "funkycommerceStaticGenerationConfig",
    ),
    true,
  );
  assert.equal(
    hasOnlyMissingRootField(
      [{ message: 'Cannot query field "funkycommerceStaticGenerationConfig" on type "Page".' }],
      "funkycommerceStaticGenerationConfig",
    ),
    false,
  );
  assert.equal(
    hasOnlyMissingRootField(
      [
        { message: 'Cannot query field "languages" on type "RootQuery".' },
        { message: "WordPress database unavailable" },
      ],
      "languages",
    ),
    false,
  );
});

test("recognizes only the requested optional field and parent type", () => {
  assert.equal(
    hasOnlyMissingField(
      [{ message: 'Cannot query field "seo" on type "Post".' }],
      "seo",
      "Post",
    ),
    true,
  );
  assert.equal(
    hasOnlyMissingField(
      [{ message: 'Cannot query field "seo" on type "Page".' }],
      "seo",
      "Post",
    ),
    false,
  );
});
