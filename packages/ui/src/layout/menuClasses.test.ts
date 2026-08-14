import assert from "node:assert/strict";
import test from "node:test";
import {
  getMegaMenuConfiguration,
  hasMenuClass,
} from "./menuClasses.ts";

test("plain mega uses the first-level child count within the supported range", () => {
  assert.deepEqual(
    getMegaMenuConfiguration(["mega"], 6),
    { columns: 6, explicit: false },
  );
  assert.deepEqual(
    getMegaMenuConfiguration(["mega"], 1),
    { columns: 2, explicit: false },
  );
  assert.deepEqual(
    getMegaMenuConfiguration(["mega"], 20),
    { columns: 14, explicit: false },
  );
});

test("mega-2 through mega-14 select an explicit column count", () => {
  assert.deepEqual(
    getMegaMenuConfiguration(["mega-2"], 8),
    { columns: 2, explicit: true },
  );
  assert.deepEqual(
    getMegaMenuConfiguration(["menu-item", "mega-14"], 2),
    { columns: 14, explicit: true },
  );
});

test("invalid mega classes do not enable mega mode", () => {
  for (const className of ["mega-1", "mega-15", "mega-04", "mega-wide", "Mega-4"]) {
    assert.equal(getMegaMenuConfiguration([className], 4), null);
  }
});

test("a valid explicit class takes precedence over plain mega", () => {
  assert.deepEqual(
    getMegaMenuConfiguration(["mega", "mega-8"], 3),
    { columns: 8, explicit: true },
  );
});

test("expanded is an exact, case-sensitive menu class", () => {
  assert.equal(hasMenuClass(["menu-item", "expanded"], "expanded"), true);
  assert.equal(hasMenuClass(["Expanded"], "expanded"), false);
  assert.equal(hasMenuClass(["expanded-menu"], "expanded"), false);
});
