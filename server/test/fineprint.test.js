import { test } from "node:test";
import assert from "node:assert/strict";
import { explainFinePrint } from "../fineprint.js";
import { mockFinePrint } from "../mock.js";
import { CLAUSE_TYPES, CLAUSES } from "../data/clauses.js";

const AS_IS = "Purchaser acknowledges the vehicle is sold AS IS unless a written warranty is provided.";

test("explainFinePrint drops unknown types and keeps the first quote per type", () => {
  const out = explainFinePrint([
    { type: "arbitration", quote: "Either you or we may choose arbitration." },
    { type: "as_is", quote: AS_IS },
    { type: "as_is", quote: "Second as-is quote." },
    { type: "holder_notice", quote: "   " }, // empty after trimming: skipped
    { type: "holder_notice", quote: "Any holder of this consumer credit contract is subject to all claims." },
    null,
    { type: "toString", quote: "prototype keys aren't clause types" },
  ]);
  assert.deepEqual(out.clauses.map((c) => c.type), ["as_is", "holder_notice"]);
  assert.equal(out.clauses[0].quote, AS_IS);
  assert.equal(out.clauses[0].tone, "warning");
  assert.equal(out.clauses[1].tone, "protects");
  for (const c of out.clauses) {
    assert.ok(c.title && c.explain && c.action && c.source.name);
    assert.equal(typeof c.source.url, "string");
  }
});

test("explainFinePrint cleans up control characters, whitespace and long quotes", () => {
  const out = explainFinePrint([
    { type: "conditional_delivery", quote: "  This order is not\nbinding\u0000 until\t‮approved.\u0007 " },
    { type: "optional_products_notice", quote: "x".repeat(2000) },
    { type: "as_is", quote: { text: "not a string" } },
  ]);
  assert.equal(out.clauses[0].quote, "This order is not binding until approved.");
  assert.equal(out.clauses[1].quote.length, 400);
  assert.ok(out.clauses[1].quote.endsWith("…"));
  assert.deepEqual(out.clauses.map((c) => c.type), ["conditional_delivery", "optional_products_notice"]);
});

test("explainFinePrint answers in Spanish and falls back to English", () => {
  const es = explainFinePrint([{ type: "as_is", quote: AS_IS }], "es");
  assert.equal(es.clauses[0].title, CLAUSES.es.types.as_is.title);
  assert.equal(es.clauses[0].quote, AS_IS); // the quote stays exactly as printed
  assert.equal(es.general[0].title, CLAUSES.es.general[0].title);
  const fallback = explainFinePrint([{ type: "as_is", quote: AS_IS }], "fr");
  assert.equal(fallback.clauses[0].title, CLAUSES.en.types.as_is.title);
});

test("the checklist comes back only with conditional delivery; the general card always does", () => {
  const none = explainFinePrint([]);
  assert.deepEqual(none.clauses, []);
  assert.equal(none.checklist, null);
  assert.equal(none.general[0].type, "no_cooling_off");
  assert.equal(explainFinePrint("not a list").checklist, null);
  assert.equal(explainFinePrint([{ type: "as_is", quote: AS_IS }]).checklist, null);
  const spot = explainFinePrint([{ type: "conditional_delivery", quote: "Subject to lender approval." }], "es");
  assert.deepEqual(spot.checklist, CLAUSES.es.checklist);
});

test("every clause type has vetted text in both languages", () => {
  for (const lang of ["en", "es"]) {
    const text = CLAUSES[lang];
    for (const type of CLAUSE_TYPES) {
      const t = text.types[type];
      assert.ok(t, `${lang} ${type}`);
      assert.equal(t.tone, ["optional_products_notice", "holder_notice"].includes(type) ? "protects" : "warning");
      assert.ok(t.title && t.explain && t.action && t.source.name);
      assert.ok(t.source.url === "" || /^https:\/\/(www\.)?(consumer\.ftc|ftc|ecfr|consumerfinance)\.gov\//.test(t.source.url));
    }
    assert.ok(text.checklist.length >= 3 && text.checklist.length <= 5);
  }
  assert.equal(CLAUSES.en.checklist.length, CLAUSES.es.checklist.length);
});

test("mock fine print matches the sample contracts' clause types", async () => {
  const [order, risc] = (
    await Promise.all([mockFinePrint("02_predatory_phone_photo.jpg"), mockFinePrint("07_risc_high_mileage.png")])
  ).map((clauses) => explainFinePrint(clauses));
  assert.deepEqual(order.clauses.map((c) => c.type), ["conditional_delivery", "as_is", "optional_products_notice"]);
  assert.ok(order.checklist);
  assert.deepEqual(risc.clauses.map((c) => c.type), ["holder_notice"]);
});
