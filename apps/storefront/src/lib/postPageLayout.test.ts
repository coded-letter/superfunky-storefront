import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postPageSource = readFileSync(new URL("../pages/PostMockupPage.tsx", import.meta.url), "utf8");

test("post TOC sticks to the top edge when share icons are on the image", () => {
  assert.match(
    postPageSource,
    /sharePosition === "on-image" \? "lg:top-0" : "lg:top-28"/,
  );
});
