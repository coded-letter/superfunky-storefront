import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headerSource = readFileSync(new URL("HeaderMockup.tsx", import.meta.url), "utf8");
const searchSource = readFileSync(new URL("SearchAutocomplete.tsx", import.meta.url), "utf8");

test("all header action visibility controls also govern the mobile drawer", () => {
  for (const control of [
    "showSearch",
    "showAccountLink",
    "showReadingListLink",
    "showWishlistLink",
    "showCartIcon",
  ]) {
    assert.match(headerSource, new RegExp(`${control}=\\{${control}\\}`));
    assert.match(headerSource, new RegExp(`\\{${control} \\?`));
  }

  assert.match(headerSource, /headerIcons=\{headerIcons\}/);
  assert.match(headerSource, /headerIconMedia=\{headerIconMedia\}/);
});

test("expandable search is focusable when open and does not clip its results", () => {
  assert.match(headerSource, /isSearchExpanded \? "w-72 overflow-visible opacity-100"/);
  assert.match(headerSource, /inert=\{isSearchExpanded \? undefined : true\}/);
  assert.match(headerSource, /autoFocus=\{isSearchExpanded\}/);
  assert.match(searchSource, /if \(autoFocus\) inputRef\.current\?\.focus\(\)/);
});

test("same-page fragment navigation closes mobile overlays before anchor scrolling", () => {
  assert.match(
    headerSource,
    /useEffect\(\(\) => setIsMenuOpen\(false\), \[location\.hash, location\.pathname, location\.search\]\)/,
  );
});

test("header supports stacked, true single-row, centered, and floating island arrangements", () => {
  assert.match(headerSource, /export type HeaderArrangement = "classic" \| "single-row" \| "centered" \| "island"/);
  assert.match(headerSource, /arrangement === "centered"/);
  assert.match(headerSource, /arrangement === "single-row" \|\| arrangement === "island"/);
  assert.match(headerSource, /hasInlineDesktopNavigation && desktopNavigation/);
  assert.match(headerSource, /top-2\.5 w-\[calc\(100%_-_20px\)\]/);
  assert.match(headerSource, /grid-cols-\[1fr_auto_1fr\]/);
});
