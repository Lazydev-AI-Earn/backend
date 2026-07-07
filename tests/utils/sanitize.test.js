import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeJson, sanitizeText } from "../../utils/sanitize.js";

test("sanitizeText removes unquoted inline event handlers", () => {
  const input = '<div onclick=alert(1) onmouseover=test()>Safe</div>';

  assert.equal(sanitizeText(input), "<div>Safe</div>");
});

test("sanitizeJson sanitizes nested arrays and objects", () => {
  const input = {
    content: '<p onclick=alert(1)>Hello</p>',
    nested: ['<span onload=test()>World</span>'],
  };

  assert.deepEqual(sanitizeJson(input), {
    content: "<p>Hello</p>",
    nested: ["<span>World</span>"],
  });
});
