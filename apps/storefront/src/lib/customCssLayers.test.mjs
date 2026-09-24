import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  activateDeferredThemeStyles,
  escapeInlineCss,
  splitCustomCss,
} from "./customCssLayers.mjs";

test("custom CSS stays critical unless the editor explicitly separates complete rules", () => {
  assert.deepEqual(splitCustomCss(".hero {color:red}"), { critical: ".hero {color:red}", deferred: "" });
  const result = splitCustomCss(".hero {color:red}\n/* storefront:deferred */\n.footer {color:blue}");
  assert.match(result.critical, /\.hero/);
  assert.doesNotMatch(result.critical, /\.footer/);
  assert.match(result.deferred, /\.footer/);
});

test("deferred CSS activates within two seconds without waiting for React or the backend", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const dom = new JSDOM('<link rel="stylesheet" media="print" data-wordpress-deferred-style href="/deferred.css">');
  activateDeferredThemeStyles(dom.window.document);
  const link = dom.window.document.querySelector("link");
  assert.equal(link.media, "print");
  context.mock.timers.tick(2_000);
  assert.equal(link.media, "all");
  dom.window.close();
});

test("critical CSS cannot terminate its inline style element", () => {
  assert.equal(
    escapeInlineCss(".hero::after{content:'</STYLE><script>alert(1)</script>'}"),
    ".hero::after{content:'<\\/style><script>alert(1)</script>'}",
  );
});
