import test from "node:test";
import assert from "node:assert/strict";
import {
  agentConsumeSchema,
  bountyListQuerySchema,
  submissionCreateSchema,
} from "../validators/schemas.js";

test("submissionCreateSchema rejects content that becomes empty after sanitization", () => {
  assert.throws(
    () =>
      submissionCreateSchema.parse({
        bountyId: "550e8400-e29b-41d4-a716-446655440000",
        content: '<script>alert("xss")</script>',
      }),
    (error) =>
      Array.isArray(error?.issues) &&
      error.issues.some(
        (issue) => issue.path.join(".") === "content" && issue.message === "Content must include meaningful text"
      )
  );
});

test("agentConsumeSchema rejects input that becomes empty after sanitization", () => {
  assert.throws(
    () =>
      agentConsumeSchema.parse({
        input: '<iframe src="https://example.com"></iframe>',
      }),
    (error) =>
      Array.isArray(error?.issues) &&
      error.issues.some(
        (issue) => issue.path.join(".") === "input" && issue.message === "Input must include meaningful text"
      )
  );
});

test("bountyListQuerySchema rejects invalid enum and reward filters", () => {
  assert.throws(() =>
    bountyListQuerySchema.parse({
      category: "NOT_A_CATEGORY",
      status: "NOT_A_STATUS",
      minReward: "not-a-number",
    })
  );
});
