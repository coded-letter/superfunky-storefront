import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "vite";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import { auditCmsTailwind } from "./audit-cms-tailwind.mjs";
import { generateCmsTailwindContent } from "./generate-cms-tailwind-content.mjs";
import { createShellManifest } from "./artifact-publish.mjs";

test("a clean Vite build retains CMS-only CSS in the initial stylesheet and artifact shell", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "cms-tailwind-build-")));
  try {
    const inventoryPath = join(directory, ".tailwind/cms-content.html");
    const fixture = await readFile(new URL("./fixtures/artopen-tailwind.html", import.meta.url), "utf8");
    const config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));
    const result = await generateCmsTailwindContent({
      endpoint: "https://cms.example.test/graphql", environment: {}, outputPath: inventoryPath, config,
      fetchImpl: async (_url, init) => {
        const { query } = JSON.parse(init.body);
        if (query.includes("StorefrontTailwindLanguages")) return Response.json({ data: { languages: [] } });
        if (query.includes("StorefrontTailwindChrome")) return Response.json({ data: { funkycommerceStorefrontConfig: {
          branding: { promoHtml: "" }, footer: { extraHtml: "", copyrightText: "", themeCredit: "", newsletterPrivacyLabel: "" },
        } } });
        const root = query.match(/(\w+)\(first: 50/)?.[1];
        return Response.json({ data: { [root]: {
          nodes: root === "pages" ? [{ id: "home", content: fixture, headlessContent: "" }] : [],
          pageInfo: { hasNextPage: false, endCursor: null },
        } } });
      },
    });
    // No fixture utilities appear in the Vite application source: only the inventory supplies them.
    await writeFile(join(directory, "index.html"), '<html><head><script type="module" src="/main.js"></script></head><body><div id="root"></div></body></html>');
    await writeFile(join(directory, "main.js"), 'import "./style.css"; document.documentElement.dataset.ready = "true";');
    await writeFile(join(directory, "style.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;");
    await build({
      configFile: false, root: directory, logLevel: "silent",
      css: { postcss: { plugins: [tailwindcss({ ...config, content: [inventoryPath] })] } },
      build: { manifest: true },
    });
    const outputDirectory = join(directory, "dist");
    const audit = await auditCmsTailwind({ outputDirectory, inventoryPath });
    assert.equal(audit.classes, result.classes.length);
    assert.ok(audit.stylesheets.length);
    const html = await readFile(join(outputDirectory, "index.html"), "utf8");
    for (const css of audit.stylesheets) assert.ok(html.includes(`/${css}`), css);
    const manifest = createShellManifest({
      html, routes: [{ path: "/", lang: "en" }, { path: "/deep/link", lang: "en" }],
      localeCodes: ["en"], siteKey: "test", artifactOrigin: "https://cms.example.test",
    });
    for (const css of audit.stylesheets) {
      assert.ok(manifest.assets.some((asset) => asset.kind === "style" && asset.url === `/${css}`));
      assert.ok(manifest.template.includes(`/${css}`));
    }
    await writeFile(resolve(outputDirectory, audit.stylesheets[0]), ".block{display:block}");
    await assert.rejects(auditCmsTailwind({ outputDirectory, inventoryPath }), /missing from initial CSS/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
