// Runs Claude extraction on every sample contract and compares it to
// sample-contracts/answer_key.json. Needs ANTHROPIC_API_KEY in server/.env.
// Usage: npm run check            (all files)
//        npm run check -- 02      (files whose name contains "02")

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { extractDeal, MODEL } from "../extract.js";
import { analyze } from "../rules.js";

const dir = new URL("../../sample-contracts/", import.meta.url).pathname;
const key = JSON.parse(readFileSync(join(dir, "answer_key.json"), "utf8"));
const MIME = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const NUMERIC = [
  "vehicle_price", "apr", "term_months", "down_payment", "monthly_payment",
  "amount_financed", "total_of_payments", "trade_in_allowance", "trade_in_payoff", "mileage",
];

const filter = process.argv[2] ?? "";
const files = readdirSync(dir).filter((f) => MIME[extname(f).toLowerCase()] && f.includes(filter)).sort();

let fieldsRight = 0, fieldsTotal = 0, verdictsRight = 0;
for (const file of files) {
  // Match on the leading number: 02_predatory_phone_photo.jpg -> 02_predatory.pdf
  const sample = key.find((s) => s.file.split("_")[0] === file.split("_")[0]);
  if (!sample) continue;
  const exp = sample.expected_extraction;

  const started = Date.now();
  let got;
  try {
    got = await extractDeal(readFileSync(join(dir, file)), MIME[extname(file).toLowerCase()]);
  } catch (err) {
    console.log(`\n${file}: FAILED ${err.message}`);
    continue;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  const misses = [];
  for (const f of NUMERIC) {
    fieldsTotal++;
    if (Math.abs((got[f] ?? 0) - exp[f]) < 0.01) fieldsRight++;
    else misses.push(`${f}: got ${got[f]}, want ${exp[f]}`);
  }
  // Line items: compare amounts across fees + add-ons, since the split can vary.
  const amounts = (d) => [...d.fees, ...d.add_ons].map((i) => i.amount).sort((a, b) => a - b).join(",");
  fieldsTotal++;
  if (amounts(got) === amounts(exp)) fieldsRight++;
  else misses.push(`fees+add_ons: got [${amounts(got)}], want [${amounts(exp)}]`);

  const expected = analyze(
    { ...exp, taxes_and_government_fees: [] },
    { creditTier: sample.test_inputs.credit_tier, kbbValue: sample.test_inputs.kbb_value_to_enter },
  );
  const result = analyze(got, {
    creditTier: sample.test_inputs.credit_tier,
    kbbValue: sample.test_inputs.kbb_value_to_enter,
  });
  const sameVerdict = result.verdict.key === expected.verdict.key;
  if (sameVerdict) verdictsRight++;

  console.log(`\n${file} (${secs}s): score ${result.score} ${result.verdict.label}${sameVerdict ? "" : `  MISMATCH, want ${expected.verdict.label}`}`);
  for (const m of misses) console.log(`  x ${m}`);
}

console.log(`\nModel ${MODEL}: ${fieldsRight}/${fieldsTotal} fields correct, ${verdictsRight}/${files.length} verdicts correct.`);
