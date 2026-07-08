import test from "node:test";
import assert from "node:assert/strict";
import { extractGitHubPRInfo } from "../utils/extractGitHubPRInfo.js";

test("extractGitHubPRInfo parses pull request URLs with query strings", () => {
  const parsed = extractGitHubPRInfo("https://github.com/openai/codex/pull/123?foo=bar");

  assert.deepEqual(parsed, {
    owner: "openai",
    repo: "codex",
    pull_number: "123",
  });
});

test("extractGitHubPRInfo rejects non-pull-request URLs", () => {
  assert.throws(
    () => extractGitHubPRInfo("https://github.com/openai/codex/issues/123"),
    /Invalid GitHub pull request URL/
  );
});
