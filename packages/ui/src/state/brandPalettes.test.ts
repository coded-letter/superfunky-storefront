import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRAND_COLOR_STEPS,
  BRAND_PALETTES,
  brandPaletteCssVariables,
} from "./brandPalettes.ts";

test("static and runtime palette variables share the canonical Layout Studio contract", () => {
  const variables = brandPaletteCssVariables("ocean", "flat");

  assert.equal(variables.length, BRAND_COLOR_STEPS.length + 2);
  assert.ok(variables.includes("--brand-500:14 165 233"));
  assert.ok(variables.includes("--brand-gradient-from:2 132 199"));
  assert.ok(variables.includes("--brand-gradient-to:2 132 199"));
  assert.equal(BRAND_PALETTES.ocean.scale["500"], "#0ea5e9");
});
