import test from "node:test";
import assert from "node:assert/strict";
import { paginationQuery, toSkipTake } from "../validators/common.js";

test("paginationQuery falls back to defaults for invalid values", () => {
  const parsed = paginationQuery().parse({
    page: "abc",
    limit: "nope",
  });

  assert.deepEqual(parsed, { page: 1, limit: 20 });
  assert.deepEqual(toSkipTake(parsed), { skip: 0, take: 20 });
});

test("paginationQuery clamps values into supported bounds", () => {
  const parsed = paginationQuery().parse({
    page: "0",
    limit: "500",
  });

  assert.deepEqual(parsed, { page: 1, limit: 100 });
});
