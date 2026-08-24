import assert from "node:assert/strict";
import test from "node:test";
import { addDefaultCmsIconDimensions } from "./cmsIconSizing.mjs";

test("adds stable intrinsic dimensions to editor icon blocks", () => {
  assert.equal(
    addDefaultCmsIconDimensions(
      '<div class="aligncenter wp-block-icon"><svg viewBox="0 0 24 24"><path /></svg></div>',
    ),
    '<div class="aligncenter wp-block-icon"><svg viewBox="0 0 24 24" width="24" height="24"><path /></svg></div>',
  );
  assert.equal(
    addDefaultCmsIconDimensions(
      '<figure class="wp-block-icon"><svg viewbox="0 0 48 24"><path /></svg></figure>',
    ),
    '<figure class="wp-block-icon"><svg viewbox="0 0 48 24" width="24" height="12"><path /></svg></figure>',
  );
});

test("preserves explicit editor icon dimensions and ignores unrelated SVGs", () => {
  const html = [
    '<div class="wp-block-icon"><svg width="32" height="32" viewBox="0 0 24 24"></svg></div>',
    '<div class="wp-block-social-link"><svg viewBox="0 0 24 24"></svg></div>',
  ].join("");

  assert.equal(addDefaultCmsIconDimensions(html), html);
});
