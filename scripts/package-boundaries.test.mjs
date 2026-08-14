import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const packageRoot = path.join(frontendRoot, "packages");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [absolute] : [];
  }));
  return nested.flat();
}

test("frontend package manifests follow the specified dependency direction", async () => {
  const allowed = {
    shared: new Set(),
    sdk: new Set(["@funky/shared"]),
    ui: new Set(["@funky/shared", "entities"]),
    cms: new Set(["@funky/sdk", "@funky/shared", "@funky/ui"]),
    commerce: new Set(["@funky/sdk", "@funky/shared", "@funky/ui"]),
  };

  for (const [packageName, dependencies] of Object.entries(allowed)) {
    const manifest = JSON.parse(await readFile(path.join(packageRoot, packageName, "package.json"), "utf8"));
    for (const dependency of Object.keys(manifest.dependencies || {})) {
      assert.ok(dependencies.has(dependency), `${manifest.name} must not depend on ${dependency}`);
    }
  }
});

test("SDK implementation has no presentation or application imports", async () => {
  const files = await sourceFiles(path.join(packageRoot, "sdk", "src"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from\s+["']@funky\/(?:ui|cms|commerce)["']/);
    assert.doesNotMatch(source, /from\s+["'].*apps\/storefront/);
  }
});

test("artifact cache consumers use the SDK React entry point", async () => {
  const storefrontSource = await sourceFiles(path.join(frontendRoot, "apps", "storefront", "src"));
  for (const file of storefrontSource) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /(?:from|import\()\s*["'][^"']*incrementalData/);
  }
});

test("storefront transport consumers use the SDK package root", async () => {
  const storefrontSource = await sourceFiles(path.join(frontendRoot, "apps", "storefront", "src"));
  for (const file of storefrontSource) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /[\"'][^\"']*\/(?:env|graphqlClient)(?:\.ts)?[\"']/);
  }
});
