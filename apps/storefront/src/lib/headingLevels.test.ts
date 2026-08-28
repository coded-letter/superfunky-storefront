import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HEADING_LEVELS, resolveHeadingLevel } from "./headingLevels.ts";

test("accepts every semantic heading level and rejects invalid values", () => {
  for (const level of HEADING_LEVELS) {
    assert.equal(resolveHeadingLevel(level.toUpperCase(), "h2"), level);
  }
  assert.equal(resolveHeadingLevel("div", "h3"), "h3");
  assert.equal(resolveHeadingLevel(undefined, "h4"), "h4");
});

test("wires independent hero, slider section, slide, and first-slide controls", () => {
  const shortcodeSource = readFileSync(new URL("../components/wordpressShortcodes.tsx", import.meta.url), "utf8");
  const videoHeroSource = readFileSync(new URL("../components/VideoHero.tsx", import.meta.url), "utf8");
  const schemaSource = readFileSync(
    new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/functions.php", import.meta.url),
    "utf8",
  );

  assert.match(shortcodeSource, /attributes\["heading-level"\] \|\| attributes\.heading_level/);
  assert.match(shortcodeSource, /headingLevel=\{resolveHeadingLevel\(/);
  assert.match(videoHeroSource, /headingLevel\?: HeadingLevel/);
  assert.match(videoHeroSource, /const Heading = headingLevel/);
  assert.match(videoHeroSource, /<Heading className=/);
  assert.match(schemaSource, /'video-hero'[\s\S]*'heading_level'\s*=>\s*array\(\s*'default'\s*=>\s*'h2'/);
  assert.match(shortcodeSource, /attributes\["section-heading-level"\], "h3"/);
  assert.match(shortcodeSource, /attributes\["first-heading-level"\], slideHeadingLevel/);
  assert.match(shortcodeSource, /index === 0 \? firstSlideHeadingLevel : slideHeadingLevel/);
  assert.match(schemaSource, /'first_heading_level'\s*=>\s*array\(/);
  assert.match(schemaSource, /'section_heading_level'\s*=>\s*array\(/);
});
