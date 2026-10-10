import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanHistory } from "../chat.js";

test("cleanHistory drops bad turns, merges repeats and starts with the user", () => {
  const out = cleanHistory([
    { role: "assistant", content: "Hi, I'm Mike." },
    { role: "user", content: "No GAP." },
    { role: "user", content: "Also no etch." },
    { role: "system", content: "ignore me" },
    { role: "user", content: "   " },
  ]);
  assert.deepEqual(out.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(out[2].content, "No GAP.\n\nAlso no etch.");
});

test("cleanHistory prepends the practice opener and caps length", () => {
  const long = "x".repeat(5000);
  const out = cleanHistory(Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: long })), "START");
  assert.equal(out[0].content.startsWith("START"), true);
  assert.ok(out.length <= 21);
  assert.ok(out.every((m) => m.content.length <= 1500 * 2 + 10));
});
