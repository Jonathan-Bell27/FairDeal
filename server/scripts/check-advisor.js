// Runs Claude's live research on one sample contract and prints the report.
// Needs ANTHROPIC_API_KEY in server/.env. Uses web search (a few cents a run).
// Usage: npm run advise -- [sample number] [zip] [monthly take-home pay] [es]
//   e.g. npm run advise -- 02 30303 3800

import "dotenv/config";
import { readFileSync } from "node:fs";
import { runAdvisor, ADVISOR_MODEL } from "../advisor.js";
import { analyze } from "../rules.js";

const [num = "02", zip = "30303", income = "3800", lang = "en"] = process.argv.slice(2);
const key = JSON.parse(readFileSync(new URL("../../sample-contracts/answer_key.json", import.meta.url), "utf8"));
const sample = key.find((s) => s.file.startsWith(num));
if (!sample) throw new Error(`No sample ${num}`);

const e = sample.expected_extraction;
const deal = { ...e, taxes_and_government_fees: Object.entries(e.taxes_and_government_fees).map(([name, amount]) => ({ name, amount })) };
const analysis = analyze(deal, { creditTier: sample.test_inputs.credit_tier, kbbValue: sample.test_inputs.kbb_value_to_enter, lang });

console.log(`${sample.file} with ${ADVISOR_MODEL}: score ${analysis.score}, ZIP ${zip}, take-home $${income}/mo\n`);
const started = Date.now();
const report = await runAdvisor(
  { deal: analysis.deal, analysis, profile: { zip, monthly_income: Number(income), keep_years: 5 }, lang },
  (event, data) => {
    if (event === "search") console.log(`  searched: ${data.query}`);
    if (event === "source") console.log(`    read: ${data.title}`);
  },
);
console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
console.log(JSON.stringify(report, null, 2));
