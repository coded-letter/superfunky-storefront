import assert from "node:assert/strict";
import test from "node:test";

import { createPaginationSequenceKey } from "./paginationState.ts";

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
