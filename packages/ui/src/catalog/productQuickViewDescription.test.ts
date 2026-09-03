import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductQuickViewDescription } from "./productQuickViewDescription.ts";

const product = {
  subtitle: "Short description",
  longDescription: "Long description",
};

test("quick view follows the configured product description order", () => {
  assert.equal(
    resolveProductQuickViewDescription(product, "short-first"),
    "Short description",
  );
  assert.equal(
    resolveProductQuickViewDescription(product, "long-first"),
    "Long description",
  );
});

test("quick view falls back to the available description", () => {
  assert.equal(
    resolveProductQuickViewDescription({ subtitle: "Short description" }, "long-first"),
    "Short description",
  );
  assert.equal(
    resolveProductQuickViewDescription({ longDescription: "Long description" }, "short-first"),
    "Long description",
  );
});
