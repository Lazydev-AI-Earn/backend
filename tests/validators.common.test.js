import test from "node:test";
import assert from "node:assert/strict";
import {
  nonNegativeDecimalString,
  paginationQuery,
  positiveDecimalString,
  toSkipTake,
  walletSchema,
} from "../validators/common.js";

test("paginationQuery falls back to defaults for invalid values", () => {
  const parsed = paginationQuery().parse({
    page: "abc",
    limit: "nope",
  });

  assert.deepEqual(parsed, { page: 1, limit: 20 });
  assert.deepEqual(toSkipTake(parsed), { skip: 0, take: 20 });
});

test("paginationQuery falls back to defaults for non-integer values", () => {
  const parsed = paginationQuery().parse({
    page: "2abc",
    limit: "1.5",
  });

  assert.deepEqual(parsed, { page: 1, limit: 20 });
});

test("paginationQuery clamps values into supported bounds", () => {
  const parsed = paginationQuery().parse({
    page: "0",
    limit: "500",
  });

  assert.deepEqual(parsed, { page: 1, limit: 100 });
});

test("walletSchema normalizes casing and surrounding whitespace", () => {
  const parsed = walletSchema.parse("  0x000000000000000000000000000000000000dEaD  ");

  assert.equal(parsed, "0x000000000000000000000000000000000000dead");
});

test("decimal schemas accept surrounding whitespace", () => {
  assert.equal(positiveDecimalString.parse(" 12.5 "), "12.5");
  assert.equal(nonNegativeDecimalString.parse(" 0 "), "0");
});
