import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeJson, sanitizeText } from "../utils/sanitize.js";

test("sanitizeText removes unquoted inline event handlers", () => {
  const sanitized = sanitizeText('<img src=x onerror=alert(1)><div onclick=test()>Hi</div>');

  assert.equal(sanitized, "<img src=x><div>Hi</div>");
});

test("sanitizeJson sanitizes nested string fields", () => {
  const sanitized = sanitizeJson({
    content: '<img src=x onerror=alert(1)>',
    nested: ["<button onclick=test()>Run</button>"],
  });

  assert.deepEqual(sanitized, {
    content: "<img src=x>",
    nested: ["<button>Run</button>"],
  });
});
