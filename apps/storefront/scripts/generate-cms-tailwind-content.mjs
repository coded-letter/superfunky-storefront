import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import loadConfig from "tailwindcss/loadConfig.js";

import { buildTailwindContentSource, compileCmsTailwindClasses } from "./cms-tailwind-content.mjs";

export async function generateCmsTailwindContent({
  outputPath = resolve(".tailwind/cms-content.html"),
  config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url))),
} = {}) {
  const result = await compileCmsTailwindClasses(config);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, buildTailwindContentSource(result.classes), "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  console.log(
    `[tailwind-contract] generated ${result.classes.length} reviewed utilities locally`
      + ` (${result.cssBytes} CSS bytes).`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--contract-only");
  Promise.resolve().then(() => {
    if (unknown.length) {
      throw new Error(`Unknown Tailwind contract option: ${unknown.join(", ")}. Use --contract-only.`);
    }
    return generateCmsTailwindContent();
  }).catch((error) => {
    console.error(`[tailwind-contract] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
