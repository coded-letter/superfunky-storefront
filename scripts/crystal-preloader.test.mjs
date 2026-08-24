import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../apps/storefront/", import.meta.url);
const [html, component, styles, main] = await Promise.all([
  readFile(new URL("index.html", appRoot), "utf8"),
  readFile(new URL("src/components/CrystalPreloader.tsx", appRoot), "utf8"),
  readFile(new URL("src/styles.css", appRoot), "utf8"),
  readFile(new URL("src/main.tsx", appRoot), "utf8"),
]);

const inlineLoader = html.slice(
  html.indexOf('<span class="funky-crystal-preloader"'),
  html.indexOf('<span class="storefront-bootstrap-label"'),
);

const keyframes = (source, name) => {
  const start = source.indexOf(`@keyframes ${name}`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return "";
};

test("the solid is one true eight-face CSS square bipyramid", () => {
  for (const source of [component, inlineLoader]) {
    assert.equal([...source.matchAll(/funky-crystal-preloader__face funky-crystal-preloader__face--/g)].length, 8);
    assert.equal([...source.matchAll(/funky-crystal-preloader__face--upper/g)].length, 4);
    assert.equal([...source.matchAll(/funky-crystal-preloader__face--lower/g)].length, 4);
    for (const direction of ["north", "east", "south", "west"]) {
      assert.equal([...source.matchAll(new RegExp(`funky-crystal-preloader__face--${direction}`, "g"))].length, 2);
    }
    assert.doesNotMatch(source, /<svg|<path|side-profile|__plane|extrusion/i);
  }
  assert.match(styles, /clip-path: polygon\(50% 0, 100% 100%, 0 100%\)/);
  assert.match(styles, /clip-path: polygon\(0 0, 100% 0, 50% 100%\)/);
  assert.match(styles, /transform-origin: 50% 100%/);
  assert.match(styles, /transform-origin: 50% 0/);
  assert.match(styles, /translateZ\(calc\(var\(--crystal-size, 30px\) \* \.33335\)\) rotateX\(33\.69deg\)/);
  assert.match(styles, /translateZ\(calc\(var\(--crystal-size, 30px\) \* \.33335\)\) rotateX\(-33\.69deg\)/);
});

test("four Y orientations join the faces around the square equator", () => {
  assert.match(styles, /__face--north \{[\s\S]*?--face-turn: 0deg/);
  assert.match(styles, /__face--east \{[\s\S]*?--face-turn: 90deg/);
  assert.match(styles, /__face--south \{[\s\S]*?--face-turn: 180deg/);
  assert.match(styles, /__face--west \{[\s\S]*?--face-turn: 270deg/);
  assert.match(styles, /transform: rotateY\(var\(--face-turn\)\) translateZ/);
  assert.match(styles, /backface-visibility: hidden/);
});

test("faces use only three restrained current-color tones", () => {
  const toneDefinitions = [...styles.matchAll(/^\s+--crystal-tone-([\w-]+):/gm)].map((match) => match[1]);
  assert.deepEqual(toneDefinitions, ["light", "base", "deep"]);
  assert.match(styles, /--crystal-tone-light: color-mix\(in srgb, currentColor 80%, white\)/);
  assert.match(styles, /--crystal-tone-base: currentColor/);
  assert.match(styles, /--crystal-tone-deep: color-mix\(in srgb, currentColor 80%, black\)/);
  assert.match(styles, /background: var\(--face-tone, currentColor\)/);
  assert.doesNotMatch(component, /#[\da-f]{3,8}|gradient|overlay|facet/i);
});

test("rotation, compact scaling, glow, and reduced motion remain intact", () => {
  for (const source of [styles, html]) {
    assert.match(source, /perspective: calc\(var\(--crystal-size(?:, 30px)?\) \* 7\.3333\)/);
    assert.match(source, /transform-style: preserve-3d/);
    assert.match(source, /storefront-crystal-turn calc\(3s/);
    assert.match(source, /to \{ transform: rotateY\(360deg\); \}/);
    assert.match(source, /radial-gradient\(circle at center, var\(--crystal-glow-color, currentColor\) 0 32%, transparent 72%\)/);
    assert.match(source, /prefers-reduced-motion[\s\S]*?__solid \{[\s\S]*?animation: none/);
  }
  const pulse = keyframes(styles, "storefront-crystal-glow");
  assert.match(pulse, /opacity: var\(--crystal-glow-opacity, \.16\)/);
  assert.match(pulse, /opacity: min\(1, calc\(var\(--crystal-glow-opacity, \.16\) \* 1\.5\)\)/);
  assert.match(styles, /height: var\(--crystal-size, 30px\)/);
  assert.match(styles, /width: calc\(var\(--crystal-size, 30px\) \* \.6667\)/);
});

test("loader API, accessibility, fail-open behavior, and dependency-free rendering are preserved", () => {
  assert.match(component, /size = 30/);
  assert.match(component, /speedMultiplier = 1/);
  assert.match(component, /className\?: string/);
  assert.match(component, /color\?: string/);
  assert.match(component, /glowColor\?: string/);
  assert.match(component, /glowOpacity\?: number/);
  assert.match(component, /style\?: CSSProperties/);
  assert.doesNotMatch(component, /^import (?!type)/m);
  assert.match(html, /--crystal-size: 30px/);
  assert.match(html, /--storefront-bootstrap-bg: var\(--wp--preset--color--contrast, #09090b\)/);
  assert.match(inlineLoader, /aria-hidden="true" data-crystal-axis="y"/);
  assert.doesNotMatch(html, /storefront-bootstrap-fail-open/);
  assert.match(main, /if \(!prerenderRoot\) failOpenTimer = window\.setTimeout\(finishBootstrap, 2_800\)/);
  assert.doesNotMatch(main, /4_000/);
});

test("inline and hydrated loaders have matching visual structure", () => {
  const classes = (source) => [...source.matchAll(/funky-crystal-preloader__(?:[\w-]+)/g)].map((match) => match[0]);
  assert.deepEqual(classes(inlineLoader), classes(component));
});
