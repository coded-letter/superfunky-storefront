import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import {
  buildTailwindContentSource,
  CMS_TAILWIND_STABLE_UTILITIES,
  compileCmsTailwindClasses,
  cssClassNames,
} from "./cms-tailwind-content.mjs";

const config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));

test("the reviewed utility contract compiles without CMS content", async () => {
  const result = await compileCmsTailwindClasses(config);

  assert.equal(result.candidateCount, CMS_TAILWIND_STABLE_UTILITIES.length);
  assert.ok(result.classes.includes("md:grid-cols-2"));
  assert.ok(result.classes.includes("dark:bg-zinc-900"));
  assert.ok(result.classes.includes("hover:bg-brand-500"));
  assert.ok(result.cssBytes > 0);
});

test("the generated contract remains visible to the production content scanner", async () => {
  const { classes } = await compileCmsTailwindClasses(config);
  const css = await postcss([
    tailwindcss({ ...config, content: [{ raw: buildTailwindContentSource(classes), extension: "html" }] }),
  ]).process("@tailwind components;\n@tailwind utilities;", { from: undefined });
  const generated = cssClassNames(css.css);

  for (const token of ["md:grid-cols-2", "dark:bg-zinc-900", "hover:bg-brand-500"]) {
    assert.ok(generated.has(token), token);
  }
});
