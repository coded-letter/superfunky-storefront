import assert from "node:assert/strict";
import test from "node:test";

import postcss from "postcss";
import tailwindcss from "tailwindcss";

import {
  buildTailwindContentSource,
  collectCmsTailwindClasses,
  evaluateCmsClassToken,
} from "./cms-tailwind-content.mjs";

test("stable and manifest-provided CMS utilities are compiled without accepting unsafe arbitrary values", async () => {
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
  assert.ok(classes.includes("hover:text-fuchsia-600"));
  assert.ok(classes.includes("dark:bg-zinc-950"));
  assert.ok(!classes.includes("active:scale-[0.97]"));
  assert.ok(rejected.some(({ token }) => token === "active:scale-[0.97]"));
  assert.deepEqual(dynamic, ["dark:bg-zinc-950", "hover:text-fuchsia-600"]);
  assert.ok(!classes.includes("wp-block-group"));
  assert.ok(!classes.includes("cms-card"));
  assert.match(result.css, /\.bg-cyan-700/);
  assert.match(result.css, /\.md\\:grid-cols-3/);
  assert.match(result.css, /\.hover\\:text-fuchsia-600:hover/);
  assert.match(result.css, /\.dark\\:bg-zinc-950/);
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

test("extractor ignores data-class and similarly named attributes", () => {
  const { classes } = collectCmsTailwindClasses([
    '<div data-class="bg-fuchsia-600" x-bind:class="bg-lime-600" class="bg-orange-600"></div>',
  ]);
  assert.ok(classes.includes("bg-orange-600"));
  assert.ok(!classes.includes("bg-fuchsia-600"));
  assert.ok(!classes.includes("bg-lime-600"));
});

test("extractor reads Gutenberg className values without rendering blocks", () => {
  const { dynamic } = collectCmsTailwindClasses([
    '<!-- wp:group {"className":"bg-[#ED225D] md:grid-cols-7"} -->',
  ]);
  assert.deepEqual(dynamic, ["bg-[#ED225D]", "md:grid-cols-7"]);
});

test("allows only arbitrary values that the route CSS compiler supports", () => {
  assert.equal(evaluateCmsClassToken("bg-[#ED225D]/30").status, "dynamic");
  assert.equal(evaluateCmsClassToken("from-[#7C3AED]").status, "dynamic");
  assert.equal(evaluateCmsClassToken("via-[#ED225D]/30").status, "dynamic");
  assert.equal(evaluateCmsClassToken("to-[#66E0FF]").status, "dynamic");
  assert.equal(evaluateCmsClassToken("z-[999]").status, "dynamic");
  assert.equal(
    evaluateCmsClassToken("hover:shadow-[0_0_12px_rgba(237,34,93,0.35)]").status,
    "rejected",
  );
  assert.equal(evaluateCmsClassToken("bg-[url(https://example.com/image.png)]").status, "rejected");
});

test("dev extraction additionally compiles approved CMS effects while rejecting unsafe URLs", async () => {
  const fixture = '<div class="md:text-5xl shadow-[0_0_12px_rgba(237,34,93,0.35)] bg-[url(https://example.com/image.png)]"></div>';
  const standard = collectCmsTailwindClasses([fixture]);
  const development = collectCmsTailwindClasses([fixture], {
    allowNonStableUtilities: true,
    includeDynamic: true,
  });
  const result = await postcss([
    tailwindcss({
      content: [{ raw: buildTailwindContentSource(development.classes), extension: "html" }],
      darkMode: "class",
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.ok(standard.classes.includes("md:text-5xl"));
  assert.ok(development.classes.includes("md:text-5xl"));
  assert.ok(!standard.classes.includes("shadow-[0_0_12px_rgba(237,34,93,0.35)]"));
  assert.ok(development.classes.includes("shadow-[0_0_12px_rgba(237,34,93,0.35)]"));
  assert.ok(!development.classes.includes("bg-[url(https://example.com/image.png)]"));
  assert.match(result.css, /\.md\\:text-5xl/);
  assert.match(result.css, /\.shadow-/);
  assert.doesNotMatch(result.css, /example\.com/);
});

test("dev extraction compiles common safe CMS effects and important sizing utilities", async () => {
  const fixture = `
    <div class="hover:shadow-[0_0_25px_rgba(0,255,200,0.45)] blur-[140px]
      hover:scale-[1.03] group-hover:-translate-y-0.5
      bg-[length:200%_200%] dark:from-[#101010]/85
      group-hover:translate-y-[-4px] animate-[floatLight_8s_ease-in-out_infinite]
      !max-h-[75px] rounded-[calc(1.5rem-2px)] md:grid-cols-[70%_30%]
      tracking-[0.25em] group-hover:text-[#90b74b]"></div>
  `;
  const development = collectCmsTailwindClasses([fixture], {
    allowNonStableUtilities: true,
    includeDynamic: true,
  });
  const result = await postcss([
    tailwindcss({
      content: [{ raw: buildTailwindContentSource(development.classes), extension: "html" }],
      darkMode: "class",
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.deepEqual(development.rejected, []);
  assert.match(result.css, /\.hover\\:shadow-/);
  assert.match(result.css, /\.blur-\\\[140px\\\]/);
  assert.match(result.css, /\.hover\\:scale-/);
  assert.match(result.css, /\.group-hover\\\:-translate-y-0\\.5/);
  assert.match(result.css, /\.dark\\:from-/);
  assert.match(result.css, /\.\\!max-h-/);
  assert.match(result.css, /\.md\\:grid-cols-/);
  assert.match(result.css, /\.tracking-/);
  assert.match(result.css, /\.group-hover\\:text-/);
});

test("compiles CMS-authored gradients with arbitrary hexadecimal stops", async () => {
  const fixture = `
    <div class="h-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#66E0FF]"></div>
  `;
  const { classes, dynamic, rejected } = collectCmsTailwindClasses([fixture]);
  const source = buildTailwindContentSource(classes);
  const result = await postcss([
    tailwindcss({
      content: [{ raw: source, extension: "html" }],
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.ok(classes.includes("bg-gradient-to-r"));
  assert.ok(classes.includes("from-[#7C3AED]"));
  assert.ok(classes.includes("to-[#66E0FF]"));
  assert.ok(dynamic.includes("from-[#7C3AED]"));
  assert.ok(dynamic.includes("to-[#66E0FF]"));
  assert.deepEqual(rejected, []);
  assert.match(result.css, /\.bg-gradient-to-r/);
  assert.match(result.css, /\.from-\\\[\\#7C3AED\\\]/);
  assert.match(result.css, /\.to-\\\[\\#66E0FF\\\]/);
});
