import test from "node:test";
import assert from "node:assert/strict";

import { paginationQuery, toSkipTake } from "../../validators/common.js";

test("paginationQuery falls back to defaults for non-numeric values", () => {
  const parsed = paginationQuery().parse({
    page: "abc",
    limit: "not-a-number",
  });

  assert.deepEqual(parsed, { page: 1, limit: 20 });
  assert.deepEqual(toSkipTake(parsed), { skip: 0, take: 20 });
});

test("paginationQuery clamps out-of-range values", () => {
  const parsed = paginationQuery().parse({
    page: "0",
    limit: "1000",
  });

  assert.deepEqual(parsed, { page: 1, limit: 100 });
  assert.deepEqual(toSkipTake(parsed), { skip: 0, take: 100 });
});
