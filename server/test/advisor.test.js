import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyLinks } from "../advisor.js";

const report = {
  summary: "s",
  affordability: { verdict: "unknown", explanation: "e" },
  plan: [],
  say_this: [],
  walk_away_if: [],
  recalls: [{ title: "Real", detail: "d", source_url: "https://www.nhtsa.gov/recalls?nhtsaId=1" }],
  known_issues: [{ title: "Made up", detail: "d", source_url: "https://example.com/not-searched" }],
  rates: [{ lender: "CU", apr: "6%", detail: "d", source_url: "" }],
  comparables: [],
};

test("verifyLinks keeps retrieved URLs and blanks the rest", () => {
  const sources = new Map([["https://www.nhtsa.gov/recalls?nhtsaId=1", "NHTSA"]]);
  const out = verifyLinks(report, sources);
  assert.equal(out.recalls[0].source_url, "https://www.nhtsa.gov/recalls?nhtsaId=1");
  assert.equal(out.known_issues[0].source_url, "");
  assert.equal(out.known_issues[0].title, "Made up"); // finding kept, link dropped
  assert.equal(out.rates[0].source_url, "");
  assert.deepEqual(out.sources, [{ url: "https://www.nhtsa.gov/recalls?nhtsaId=1", title: "NHTSA" }]);
});
