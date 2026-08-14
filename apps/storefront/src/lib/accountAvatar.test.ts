import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  validateAvatarFile,
} from "./accountAvatar.ts";

test("accepts each supported avatar MIME type at the size limit", () => {
  for (const type of AVATAR_ALLOWED_MIME_TYPES) {
    assert.equal(validateAvatarFile({ type, size: AVATAR_MAX_BYTES }), null);
  }
});

test("rejects unsupported, empty, and oversized avatar files", () => {
  assert.match(validateAvatarFile({ type: "image/svg+xml", size: 100 }) || "", /JPEG/);
  assert.match(validateAvatarFile({ type: "image/png", size: 0 }) || "", /690 KB/);
  assert.match(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 }) || "", /690 KB/);
});
