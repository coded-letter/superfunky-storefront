import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOADER_CONFIGURATION,
  getLoaderMediaKind,
  loaderSpeedMultiplier,
  normalizeLoaderConfiguration,
  resolveLoaderPresentation,
} from "./loaderConfig.ts";

test("normalizeLoaderConfiguration falls back to defaults for missing/malformed input", () => {
  assert.deepEqual(normalizeLoaderConfiguration(null), DEFAULT_LOADER_CONFIGURATION);
  assert.deepEqual(normalizeLoaderConfiguration(undefined), DEFAULT_LOADER_CONFIGURATION);
  assert.deepEqual(
    normalizeLoaderConfiguration({
      enabled: "yes" as unknown as boolean,
      customUrl: "not-a-url",
      size: Number.NaN,
      duration: "oops" as unknown as number,
      primaryColor: "purple",
      glowColor: "#zzz",
      glowOpacity: "half" as unknown as number,
    }),
    DEFAULT_LOADER_CONFIGURATION,
  );
});

test("normalizeLoaderConfiguration clamps out-of-range numbers to the backend's min/max", () => {
  const result = normalizeLoaderConfiguration({
    enabled: true,
    customUrl: null,
    size: 10_000,
    duration: -5,
    primaryColor: "#111",
    glowColor: "#222222",
    glowOpacity: 4,
  });
  assert.equal(result.size, 240);
  assert.equal(result.duration, 400);
  assert.equal(result.glowOpacity, 1);
  assert.equal(result.primaryColor, "#111");
  assert.equal(result.glowColor, "#222222");
});

test("normalizeLoaderConfiguration accepts a valid custom media URL", () => {
  const result = normalizeLoaderConfiguration({
    customUrl: "https://cdn.example.com/loaders/crystal.webp",
  });
  assert.equal(result.customUrl, "https://cdn.example.com/loaders/crystal.webp");
});

test("normalizeLoaderConfiguration rejects unsupported or unsafe custom media URLs", () => {
  assert.equal(normalizeLoaderConfiguration({ customUrl: "https://cdn.example.com/loaders/crystal.exe" }).customUrl, null);
  assert.equal(normalizeLoaderConfiguration({ customUrl: "javascript:alert(1)" }).customUrl, null);
  assert.equal(normalizeLoaderConfiguration({ customUrl: "" }).customUrl, null);
  assert.equal(normalizeLoaderConfiguration({ customUrl: "  " }).customUrl, null);
});

test("getLoaderMediaKind classifies known image and video extensions", () => {
  assert.equal(getLoaderMediaKind("https://example.com/a.gif"), "image");
  assert.equal(getLoaderMediaKind("https://example.com/a.svg?ver=2"), "image");
  assert.equal(getLoaderMediaKind("https://example.com/a.webp"), "image");
  assert.equal(getLoaderMediaKind("https://example.com/a.mp4"), "video");
  assert.equal(getLoaderMediaKind("https://example.com/a.webm"), "video");
  assert.equal(getLoaderMediaKind("https://example.com/a.exe"), null);
  assert.equal(getLoaderMediaKind("ftp://example.com/a.gif"), null);
  assert.equal(getLoaderMediaKind(null), null);
  assert.equal(getLoaderMediaKind(undefined), null);
});

test("loaderSpeedMultiplier is relative to the backend's default duration", () => {
  assert.equal(loaderSpeedMultiplier(1400), 1);
  assert.equal(loaderSpeedMultiplier(700), 2);
  assert.equal(loaderSpeedMultiplier(2800), 0.5);
  assert.equal(loaderSpeedMultiplier(0), 1);
  assert.equal(loaderSpeedMultiplier(Number.NaN), 1);
});

test("resolveLoaderPresentation hides the loader when disabled", () => {
  assert.deepEqual(
    resolveLoaderPresentation({ ...DEFAULT_LOADER_CONFIGURATION, enabled: false }),
    { mode: "hidden" },
  );
});

test("resolveLoaderPresentation falls back to the bundled crystal without valid custom media", () => {
  assert.deepEqual(resolveLoaderPresentation(DEFAULT_LOADER_CONFIGURATION), { mode: "crystal" });
});

test("resolveLoaderPresentation renders custom media when valid and motion isn't reduced", () => {
  const loader = { ...DEFAULT_LOADER_CONFIGURATION, customUrl: "https://cdn.example.com/loaders/crystal.mp4" };
  assert.deepEqual(resolveLoaderPresentation(loader), { mode: "video", url: loader.customUrl });
});

test("resolveLoaderPresentation falls back to the bundled crystal when the custom media failed to load", () => {
  const loader = { ...DEFAULT_LOADER_CONFIGURATION, customUrl: "https://cdn.example.com/loaders/crystal.mp4" };
  assert.deepEqual(resolveLoaderPresentation(loader, { mediaFailed: true }), { mode: "crystal" });
});

test("resolveLoaderPresentation prefers the bundled crystal when the visitor prefers reduced motion", () => {
  const loader = { ...DEFAULT_LOADER_CONFIGURATION, customUrl: "https://cdn.example.com/loaders/crystal.gif" };
  assert.deepEqual(resolveLoaderPresentation(loader, { prefersReducedMotion: true }), { mode: "crystal" });
});
