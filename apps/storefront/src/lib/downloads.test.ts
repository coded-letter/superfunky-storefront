import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSource = readFileSync(
  new URL("../components/DigitalDownloadsPanel.tsx", import.meta.url),
  "utf8",
);
const downloadsSource = readFileSync(new URL("./downloads.ts", import.meta.url), "utf8");

test("fetches signed backend downloads as blobs with credentials and server filenames", () => {
  assert.match(downloadsSource, /fetchImpl\(download\.url,\s*\{/);
  assert.match(downloadsSource, /credentials: "include"/);
  assert.match(downloadsSource, /cache: "no-store"/);
  assert.match(downloadsSource, /response\.blob\(\)/);
  assert.match(downloadsSource, /Content-Disposition/);
  assert.match(downloadsSource, /UTF-8''/);
  assert.match(panelSource, /activeDownload/);
  assert.match(panelSource, /fetchOrderDownloadFile\(download\)/);
});

test("surfaces backend download throttling with its retry delay", () => {
  assert.match(downloadsSource, /response\.status === 429/);
  assert.match(downloadsSource, /response\.headers\.get\("Retry-After"\)/);
  assert.match(downloadsSource, /Try again\$\{retryAfter \? ` in \$\{retryAfter\} seconds`/);
});
