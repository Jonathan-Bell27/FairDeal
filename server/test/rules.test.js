// Runs the rules engine on the answer key's expected extraction and checks
// that each sample lands in the right verdict band with the right flags.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, monthlyPayment, normalizeDeal } from "../rules.js";

const answerKey = JSON.parse(
  readFileSync(new URL("../../sample-contracts/answer_key.json", import.meta.url), "utf8"),
);

// answer_key.json stores taxes as an object; the schema uses a line-item array.
const toDeal = (expected) => ({
  ...expected,
  taxes_and_government_fees: Object.entries(expected.taxes_and_government_fees ?? {}).map(
    ([name, amount]) => ({ name, amount }),
  ),
});

const run = (file) => {
  const c = answerKey.find((s) => s.file === file);
  return analyze(toDeal(c.expected_extraction), {
    creditTier: c.test_inputs.credit_tier,
    kbbValue: c.test_inputs.kbb_value_to_enter,
  });
};
const ids = (result) => result.flags.map((f) => f.id).sort();

test("01 clean: no flags, Fair deal", () => {
  const r = run("01_clean.pdf");
  assert.deepEqual(r.flags, []);
  assert.equal(r.score, 100);
  assert.equal(r.verdict.key, "fair");
});

test("02 predatory: every flag, Walk away", () => {
  const r = run("02_predatory.pdf");
  assert.deepEqual(ids(r), [
    "apr",
    "dealer_prep",
    "doc_fee",
    "gap",
    "nitrogen",
    "paint_protection",
    "price",
    "service_contract",
    "term",
    "vin_etch",
  ]);
  assert.equal(r.verdict.key, "walk");
  assert.ok(r.total_savings > 10000, `savings ${r.total_savings}`);
  const sc = r.flags.find((f) => f.id === "service_contract");
  assert.equal(sc.severity, "caution");
  assert.equal(sc.points, 0);
  assert.match(sc.title, /in interest/);
});

test("03 borderline: Negotiate", () => {
  const r = run("03_borderline.pdf");
  assert.deepEqual(ids(r), ["apr", "gap", "price", "term", "vin_etch"]);
  assert.equal(r.flags.find((f) => f.id === "term").severity, "caution");
  assert.equal(r.verdict.key, "negotiate", `score ${r.score}`);
});

test("04 buy-here-pay-here: flags and Walk away", () => {
  const r = run("04_risc_buy_here_pay_here.pdf");
  assert.deepEqual(ids(r), ["apr", "doc_fee", "gap", "gps", "price", "service_contract", "term"]);
  assert.match(r.flags.find((f) => f.id === "term").title, /high-mileage/);
  assert.equal(r.verdict.key, "walk");
});

test("points are capped at 25 per flag and score floors at 0", () => {
  for (const s of answerKey) {
    const r = run(s.file);
    assert.ok(r.score >= 0 && r.score <= 100);
    for (const f of r.flags) assert.ok(f.points <= 25);
  }
});

test("every flag carries a marked-up line item", () => {
  for (const s of answerKey) {
    for (const f of run(s.file).flags) {
      assert.ok(f.line?.label && f.line.charged && f.line.note, `${s.file} ${f.id}`);
    }
  }
});

test("loan math matches the contract", () => {
  const e = answerKey.find((s) => s.file === "01_clean.pdf").expected_extraction;
  assert.ok(Math.abs(monthlyPayment(e.amount_financed, e.apr, e.term_months) - e.monthly_payment) < 1);
});

test("normalizeDeal coerces strings and derives missing totals", () => {
  const d = normalizeDeal({
    vehicle_price: "$20,000",
    apr: "5%",
    term_months: "60",
    down_payment: 2000,
    fees: [{ name: "Doc fee", amount: "500" }],
  });
  assert.equal(d.amount_financed, 18500);
  assert.ok(d.monthly_payment > 340 && d.monthly_payment < 360);
  assert.equal(d.total_of_payments, Math.round(d.monthly_payment * 60 * 100) / 100);
});

test("rejects an unknown credit tier", () => {
  assert.throws(() => analyze({}, { creditTier: "Great" }), /credit_tier/);
});

test("counteroffer lists one ask per flag", () => {
  const r = run("02_predatory.pdf");
  const bullets = r.counteroffer.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(bullets.length, r.flags.length);
});
