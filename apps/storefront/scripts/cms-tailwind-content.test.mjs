import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import {
  buildTailwindContentSource,
  collectCmsTailwindClasses,
  compileCmsTailwindClasses,
  cssClassNames,
  evaluateCmsClassToken,
  extractHtmlClassTokens,
} from "./cms-tailwind-content.mjs";

const config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));
const fixture = await readFile(new URL("./fixtures/artopen-tailwind.html", import.meta.url), "utf8");

test("CMS-only Art Open utilities compile and survive the production content scanner", async () => {
  const { classes, rejected } = await compileCmsTailwindClasses([{ html: fixture, source: "pages/home.content" }], config);
  const expected = extractHtmlClassTokens(fixture).filter((token) => !["wp-block-group", "service-card", "group"].includes(token));
  assert.deepEqual(rejected, []);
  for (const token of expected) assert.ok(classes.includes(token), token);
  assert.ok(!classes.includes("wp-block-group"));
  assert.ok(!classes.includes("service-card"));
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: buildTailwindContentSource(classes), extension: "html" }] }),
  ]).process("@tailwind components;\n@tailwind utilities;", { from: undefined });
  const generated = cssClassNames(result.css);
  for (const token of expected) assert.ok(generated.has(token), token);
  assert.match(result.css, /width: 58\.333333%/);
  assert.match(result.css, /--tw-scale-x: 1\.03/);
  assert.match(result.css, /border-bottom-width: 0px !important/);
  assert.match(result.css, /min-height: 500px/);
});

test("unsafe constructs are excluded while unknown WordPress classes are not errors", async () => {
  const unsafe = [
    "bg-[url(javascript:alert(1))]", "bg-[url(https://example.com/image.png)]",
    "bg-[image-set(url(https://example.com/a)_1x)]", "[color:red]", "hover:[&_*]:block",
    "text-red-500;", "bg-[u\\72l(https://example.com)]", "bg-[url/*x*/(https://example.com)]",
  ];
  for (const token of unsafe) assert.equal(evaluateCmsClassToken(token).status, "rejected", token);
  const { classes, rejected } = await compileCmsTailwindClasses([
    { html: '<div class="wp-block-group is-layout-flow has-global-padding cms-card dark:bg--100 md:text-md shadow=[0_0_20px_rgba(0,255,200,0.25)]"></div>', source: "pages/home.content" },
  ], config);
  assert.ok(!classes.includes("dark:bg--100"));
  assert.deepEqual(rejected.map(({ token }) => token).sort(), ["dark:bg--100", "md:text-md", "shadow=[0_0_20px_rgba(0,255,200,0.25)]"].sort());
  assert.ok(rejected.every(({ source }) => source === "pages/home.content"));
});

test("HTML extraction decodes entities, accepts unquoted attributes and ignores scripts/comments", () => {
  assert.deepEqual(extractHtmlClassTokens(`
    <!-- <div class="text-red-400"> -->
    <script>const html = '<div class="text-red-500">';</script>
    <div class='sm&colon;w-7&sol;12 bg-[&num;ED225D]&sol;30'></div>
    <div class=font-extrabold></div>
    <div data-class="text-red-600"></div>
  `), ["sm:w-7/12", "bg-[#ED225D]/30", "font-extrabold"]);
  assert.doesNotThrow(() => extractHtmlClassTokens('<div class="&#9999999999;"></div>'));
});

test("inventory is deterministic, site-specific, and bounded", async () => {
  const left = await compileCmsTailwindClasses(['<div class="w-[731px] bg-cyan-700 w-[731px]"></div>'], config);
  const right = await compileCmsTailwindClasses(['<div class="bg-cyan-700 w-[731px]"></div>'], config);
  assert.deepEqual(left.classes, right.classes);
  const nextSite = await compileCmsTailwindClasses([], config);
  assert.ok(!nextSite.classes.includes("w-[731px]"));
  assert.ok(nextSite.classes.includes("md:grid-cols-2"));
  assert.equal(evaluateCmsClassToken(`w-[${"1".repeat(512)}px]`).status, "rejected");
  assert.throws(() => collectCmsTailwindClasses([
    `<div class="${Array.from({ length: 10_001 }, (_, index) => `w-[${index}px]`).join(" ")}"></div>`,
  ]), /class limit exceeded/);
});
