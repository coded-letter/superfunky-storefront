import assert from "node:assert/strict";
import test from "node:test";

import { createPaginationSequenceKey, resolveGridPageSize } from "./paginationState.ts";

test("grid page sizes preserve native and explicit values without a transport-size cap", () => {
  assert.equal(resolveGridPageSize(7, 30, 10), 7);
  assert.equal(resolveGridPageSize(250, 300, 10), 250);
  assert.equal(resolveGridPageSize(-1, 237, 10), 237);
  assert.equal(resolveGridPageSize(-1, 0, 10), 1);
  assert.equal(resolveGridPageSize(undefined, 30, 12), 12);
  assert.equal(resolveGridPageSize(0, 30, 12), 12);
});

test("pagination reset keys ignore equivalent refreshed item objects", () => {
  const initial = createPaginationSequenceKey([{ id: "post-1" }, { id: "post-2" }]);
  const refreshed = createPaginationSequenceKey([{ id: "post-1" }, { id: "post-2" }]);

  assert.equal(refreshed, initial);
});

test("pagination reset keys change when the visible item sequence changes", () => {
  const initial = createPaginationSequenceKey([{ id: 1 }, { id: 2 }]);

  assert.notEqual(createPaginationSequenceKey([{ id: 2 }, { id: 1 }]), initial);
  assert.notEqual(createPaginationSequenceKey([{ id: 1 }]), initial);
});
