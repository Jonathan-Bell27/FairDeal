// Fix-It Mode: the fair version of each sample deal, scored by the same rules.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, monthlyPayment } from "../rules.js";
import { TYPICAL_APR } from "../data/lookups.js";

const answerKey = JSON.parse(
  readFileSync(new URL("../../sample-contracts/answer_key.json", import.meta.url), "utf8"),
);
const run = (file, lang = "en") => {
  const c = answerKey.find((s) => s.file === file);
  const deal = {
    ...c.expected_extraction,
    taxes_and_government_fees: Object.entries(c.expected_extraction.taxes_and_government_fees ?? {}).map(
      ([name, amount]) => ({ name, amount }),
    ),
  };
  return analyze(deal, { creditTier: c.test_inputs.credit_tier, kbbValue: c.test_inputs.kbb_value_to_enter, lang });
};

test("a deal with nothing marked has no fair version", () => {
  assert.equal(run("01_clean.pdf").fair, null);
  assert.equal(run("06_new_car_promo_rate.pdf").fair, null);
});

test("02: fixing every marked line gives a fair deal at the typical rate and 60 months", () => {
  const r = run("02_predatory.pdf");
  const { fair, deal } = r;
  assert.equal(fair.score, 100);
  assert.equal(fair.verdict.key, "fair");
  assert.equal(fair.apr, TYPICAL_APR.Good.apr);
  assert.equal(fair.term_months, 60);

  // Amount financed minus every scored cut, at the fair rate and term.
  const cuts = r.flags
    .filter((f) => f.severity === "red" && f.id !== "apr" && f.id !== "term")
    .reduce((s, f) => s + f.dollar_impact, 0);
  const expected = monthlyPayment(deal.amount_financed - cuts, fair.apr, 60);
  assert.ok(Math.abs(fair.monthly_payment - expected) < 1, `${fair.monthly_payment} vs ${expected}`);
  assert.ok(fair.monthly_payment < deal.monthly_payment);
});

test("every scored line says what it becomes; caution lines don't", () => {
  const r = run("02_predatory.pdf");
  for (const f of r.flags) {
    if (f.severity === "red") assert.ok(f.line.fixed, `${f.id} has no fixed value`);
    else assert.equal(f.line.fixed, undefined);
  }
  const line = (id) => r.flags.find((f) => f.id === id).line.fixed;
  assert.equal(line("price"), "$19,800");
  assert.equal(line("term"), "60 months");
  assert.equal(line("dealer_prep"), "removed");
  assert.equal(run("02_predatory.pdf", "es").flags.find((f) => f.id === "term").line.fixed, "60 meses");
});

test("cash deals compare the itemized total", () => {
  const { fair } = run("08_cash_deal_no_financing.pdf");
  assert.equal(fair.financed, false);
  assert.equal(fair.monthly_payment, 0);
  assert.ok(fair.fair_price_total < fair.price_total);
  assert.equal(fair.score, 100);
});

test("the fair version of every sample scores 100", () => {
  for (const { file } of answerKey) {
    const { fair } = run(file);
    if (fair) assert.equal(fair.score, 100, file);
  }
});

test("a scored line that costs nothing (0% APR, 84 months) doesn't offer a fair version", () => {
  const deal = {
    vehicle_price: 25000,
    fees: [{ name: "Doc Fee", amount: 599 }],
    taxes_and_government_fees: [{ name: "Tax", amount: 1750 }],
    down_payment: 3000,
    apr: 0,
    term_months: 84,
    amount_financed: 24349,
    monthly_payment: 289.87,
  };
  assert.equal(analyze(deal, { creditTier: "Good" }).fair, null);
});

test("a first payment 45 days out isn't read as a padded payment", () => {
  // $689.37 is the exact payment for $30,000 at 18% over 72 months with a 45-day first period.
  const r = analyze(
    { vehicle_price: 30000, apr: 18, term_months: 72, amount_financed: 30000, monthly_payment: 689.37 },
    { creditTier: "Fair", kbbValue: 30000 },
  );
  assert.ok(!r.flags.some((f) => f.id === "payment_gap"));
});

test("Fix-It shows the corrected payment and amount, not just 'explained'", () => {
  const padded = analyze(
    { vehicle_price: 30000, apr: 18, term_months: 72, amount_financed: 30000, monthly_payment: 729.4 },
    { creditTier: "Fair", kbbValue: 30000 },
  );
  assert.equal(padded.flags.find((f) => f.id === "payment_gap").line.fixed, "$684");
  const hidden = analyze(
    { vehicle_price: 20000, apr: 8, term_months: 60, amount_financed: 21500 },
    { creditTier: "Good" },
  );
  assert.equal(hidden.flags.find((f) => f.id === "unexplained_amount").line.fixed, "$20,000");
});

test("negative equity counts only what the loan holds", () => {
  const r = analyze(
    {
      vehicle_price: 25000,
      taxes_and_government_fees: [{ name: "Tax", amount: 1750 }],
      trade_in_payoff: 7800,
      trade_in_allowance: 4000,
      down_payment: 32000,
      apr: 9.9,
      term_months: 60,
    },
    { creditTier: "Good", kbbValue: 25000 },
  );
  assert.ok(!r.flags.some((f) => f.id === "negative_equity"));
});
