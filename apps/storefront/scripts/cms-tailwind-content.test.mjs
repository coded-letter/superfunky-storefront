import assert from "node:assert/strict";
import test from "node:test";

import postcss from "postcss";
import tailwindcss from "tailwindcss";

import {
  buildTailwindContentSource,
  collectCmsTailwindClasses,
  evaluateCmsClassToken,
} from "./cms-tailwind-content.mjs";

test("stable CMS utilities are precompiled while arbitrary values are routed to artifact CSS", async () => {
  const fixture = `
    <section class="wp-block-group cms-card bg-cyan-700 md:grid-cols-3 hover:text-fuchsia-600 active:scale-[0.97]">
      <div class="dark:bg-zinc-950"></div>
    </section>
  `;
  const { classes, dynamic, rejected } = collectCmsTailwindClasses([fixture]);
  const source = buildTailwindContentSource(classes);
  const result = await postcss([
    tailwindcss({
      content: [{ raw: source, extension: "html" }],
      darkMode: "class",
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.ok(classes.includes("bg-cyan-700"));
  assert.ok(classes.includes("md:grid-cols-3"));
  assert.ok(!classes.includes("active:scale-[0.97]"));
  assert.ok(rejected.some(({ token }) => token === "active:scale-[0.97]"));
  assert.deepEqual(dynamic, []);
  assert.ok(!classes.includes("wp-block-group"));
  assert.ok(!classes.includes("cms-card"));
  assert.match(result.css, /\.bg-cyan-700/);
  assert.match(result.css, /\.md\\:grid-cols-3/);
  assert.doesNotMatch(result.css, /\.active\\:scale-\\\[0\\\.97\\\]/);
});

test("unsafe arbitrary values and malformed utility tokens are surfaced and excluded", () => {
  const fixture = `
    <div class="bg-[url(javascript:alert(1))] dark:bg--100 hover:[&_*]:block text-red-500; display:block"></div>
  `;
  const { classes, rejected } = collectCmsTailwindClasses([fixture]);
  const rejectedTokens = rejected.map(({ token }) => token);

  assert.ok(!classes.includes("bg-[url(javascript:alert(1))]"));
  assert.ok(!classes.includes("dark:bg--100"));
  assert.ok(!classes.includes("hover:[&_*]:block"));
  assert.ok(!classes.includes("text-red-500;"));
  assert.ok(rejectedTokens.includes("bg-[url(javascript:alert(1))]"));
  assert.ok(rejectedTokens.includes("dark:bg--100"));
  assert.ok(rejectedTokens.includes("hover:[&_*]:block"));
  assert.ok(rejectedTokens.includes("text-red-500;"));
});

test("allows only arbitrary values that the route CSS compiler supports", () => {
  assert.equal(evaluateCmsClassToken("bg-[#ED225D]/30").status, "dynamic");
  assert.equal(evaluateCmsClassToken("z-[999]").status, "dynamic");
  assert.equal(
    evaluateCmsClassToken("hover:shadow-[0_0_12px_rgba(237,34,93,0.35)]").status,
    "rejected",
  );
  assert.equal(evaluateCmsClassToken("bg-[url(https://example.com/image.png)]").status, "rejected");
});
