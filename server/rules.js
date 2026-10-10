// Deterministic rules engine. Claude only reads the document; every flag,
// dollar amount, and score comes from here so it can be explained and cited.

import {
  ADD_ONS,
  APR_SOURCE,
  APR_TOLERANCE,
  HIGH_MILEAGE,
  PRICE_SOURCE,
  PRICE_TOLERANCE,
  TERM_CAUTION_MONTHS,
  TERM_PACKING_MONTHS,
  TYPICAL_APR,
} from "./data/lookups.js";

export const CREDIT_TIERS = Object.keys(TYPICAL_APR);
export const DISCLAIMER =
  "AI-assisted analysis for informational purposes. Not financial advice. Verify terms before signing.";

const MAX_POINTS_PER_FLAG = 25;

const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(/[$,%\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const usd = (n) =>
  "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

// Monthly payment for a fully amortizing loan.
export function monthlyPayment(principal, aprPercent, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

// Coerce whatever came back from the Review screen into clean numbers.
export function normalizeDeal(raw = {}) {
  const items = (list) =>
    (Array.isArray(list) ? list : [])
      .map((i) => ({ name: String(i?.name ?? "").trim(), amount: num(i?.amount) }))
      .filter((i) => i.name || i.amount);

  const deal = {
    document_type: String(raw.document_type ?? ""),
    vehicle: String(raw.vehicle ?? ""),
    mileage: num(raw.mileage),
    vehicle_price: num(raw.vehicle_price),
    apr: num(raw.apr),
    term_months: Math.round(num(raw.term_months)),
    down_payment: num(raw.down_payment),
    trade_in_allowance: num(raw.trade_in_allowance),
    trade_in_payoff: num(raw.trade_in_payoff),
    monthly_payment: num(raw.monthly_payment),
    amount_financed: num(raw.amount_financed),
    total_of_payments: num(raw.total_of_payments),
    fees: items(raw.fees),
    add_ons: items(raw.add_ons),
    taxes_and_government_fees: items(raw.taxes_and_government_fees),
  };

  // Fill in derived values the document didn't show.
  if (!deal.amount_financed) {
    const sum = (list) => list.reduce((s, i) => s + i.amount, 0);
    deal.amount_financed = round2(
      deal.vehicle_price +
        sum(deal.fees) +
        sum(deal.add_ons) +
        sum(deal.taxes_and_government_fees) +
        deal.trade_in_payoff -
        deal.trade_in_allowance -
        deal.down_payment,
    );
  }
  if (!deal.monthly_payment) {
    deal.monthly_payment = round2(
      monthlyPayment(deal.amount_financed, deal.apr, deal.term_months),
    );
  }
  if (!deal.total_of_payments) {
    deal.total_of_payments = round2(deal.monthly_payment * deal.term_months);
  }
  return deal;
}

function flag({ id, category, title, detail, impact, source, scored = true, ask }) {
  const dollars = Math.max(0, Math.round(impact));
  return {
    id,
    category,
    severity: scored ? "red" : "caution",
    title,
    detail,
    dollar_impact: dollars,
    points: scored ? Math.min(MAX_POINTS_PER_FLAG, Math.round(dollars / 100)) : 0,
    source,
    ask, // what the counteroffer requests
  };
}

function checkApr(deal, tier) {
  const typical = TYPICAL_APR[tier];
  if (!typical || !deal.apr || !deal.term_months) return [];
  if (deal.apr <= typical.apr + APR_TOLERANCE) return [];

  const actualTotal = monthlyPayment(deal.amount_financed, deal.apr, deal.term_months) * deal.term_months;
  const fairTotal = monthlyPayment(deal.amount_financed, typical.apr, deal.term_months) * deal.term_months;
  const extra = actualTotal - fairTotal;
  const gap = deal.apr - typical.apr;

  return [
    flag({
      id: "apr",
      category: "APR vs. credit tier",
      title: `APR ${deal.apr}% is ${gap.toFixed(1)} points above typical for ${tier} credit`,
      detail: `Buyers with ${tier.toLowerCase()} credit (${typical.experianTier}) typically get about ${typical.apr}% on a used car. At that rate you'd pay about ${usd(extra)} less in interest over ${deal.term_months} months. Get pre-approved at a credit union or bank and ask the dealer to match it.`,
      impact: extra,
      source: APR_SOURCE,
      ask: `Lower the APR to ${typical.apr}% (typical for my credit tier), or I'll use outside financing.`,
    }),
  ];
}

function checkAddOns(deal) {
  const flags = [];
  const seen = new Set();
  for (const item of [...deal.fees, ...deal.add_ons]) {
    const rule = ADD_ONS.find((r) => r.match.test(item.name));
    if (!rule || item.amount <= rule.flagAbove) continue;
    const id = seen.has(rule.key) ? `${rule.key}_${seen.size}` : rule.key;
    seen.add(rule.key);
    if (rule.financed) {
      const interest = monthlyPayment(item.amount, deal.apr, deal.term_months) * deal.term_months - item.amount;
      flags.push(
        flag({
          id,
          category: "Add-ons and fees",
          title: `${item.name}: ${usd(item.amount)}, plus about ${usd(interest)} in interest`,
          detail: `${rule.why} Rolled into this loan at ${deal.apr}% for ${deal.term_months} months, it would cost about ${usd(interest)} in interest. You can pay for it separately or buy coverage later.`,
          impact: interest,
          source: rule.source,
          scored: false,
          ask: `Take the ${item.name} (${usd(item.amount)}) off the loan. I can buy coverage separately if I want it.`,
        }),
      );
      continue;
    }
    const impact = item.amount - rule.fair;
    const remove = rule.fair === 0;
    flags.push(
      flag({
        id,
        category: "Add-ons and fees",
        title: remove
          ? `${item.name}: ${usd(item.amount)} you shouldn't pay`
          : `${item.name}: ${usd(item.amount)} vs. about ${usd(rule.fair)} typical`,
        detail: rule.why,
        impact,
        source: rule.source,
        ask: rule.key === "doc_fee"
          ? `Take ${usd(impact)} off the vehicle price to offset the ${item.name}, which is above the ${usd(rule.fair)} state average.`
          : remove || rule.key === "vin_etch" || rule.key === "paint_protection"
            ? `Remove the ${item.name} (${usd(item.amount)}).`
            : `Lower the ${item.name} from ${usd(item.amount)} to ${usd(rule.fair)}, or remove it.`,
      }),
    );
  }
  return flags;
}

function checkTerm(deal) {
  if (deal.term_months < TERM_CAUTION_MONTHS) return [];
  const packing = deal.term_months >= TERM_PACKING_MONTHS;
  const at60 = monthlyPayment(deal.amount_financed, deal.apr, 60);
  const extra = deal.total_of_payments - at60 * 60;
  const overPrice = deal.total_of_payments + deal.down_payment - deal.vehicle_price;
  const highMiles = deal.mileage >= HIGH_MILEAGE;

  let detail =
    `You'd pay ${usd(deal.total_of_payments + deal.down_payment)} in total for a car priced at ${usd(deal.vehicle_price)}, ` +
    `${usd(overPrice)} more than the price. A 60-month term at the same rate would cost about ${usd(extra)} less in interest ` +
    `(${usd(at60)}/mo instead of ${usd(deal.monthly_payment)}/mo).`;
  if (highMiles) {
    detail += ` With ${deal.mileage.toLocaleString("en-US")} miles, the car may need major repairs before it's paid off.`;
  }
  if (!packing) {
    detail += " Not counted in your score: a shorter term means a higher monthly payment.";
  }

  return [
    flag({
      id: "term",
      category: "Payment packing",
      title: packing
        ? `${deal.term_months}-month loan stretches the payment to hide the cost`
        : `${deal.term_months}-month loan${highMiles ? " on a high-mileage car" : ""}`,
      detail,
      impact: extra,
      source: "Loan math from the contract's APR and amount financed",
      scored: packing,
      ask: `Show me the numbers on a 60-month term.`,
    }),
  ];
}

function checkPrice(deal, kbbValue) {
  if (!kbbValue || !deal.vehicle_price) return [];
  const over = deal.vehicle_price - kbbValue;
  if (over <= PRICE_TOLERANCE) return [];
  return [
    flag({
      id: "price",
      category: "Price vs. market",
      title: `Price is ${usd(over)} above market value`,
      detail: `The vehicle price is ${usd(deal.vehicle_price)}; Kelley Blue Book values it at ${usd(kbbValue)}.`,
      impact: over,
      source: PRICE_SOURCE,
      ask: `Bring the vehicle price down to the KBB value of ${usd(kbbValue)}.`,
    }),
  ];
}

export function verdictFor(score) {
  if (score >= 85) return { key: "fair", label: "Fair deal" };
  if (score >= 60) return { key: "negotiate", label: "Negotiate before signing" };
  return { key: "walk", label: "Walk away or get outside financing" };
}

export function buildCounteroffer(deal, flags) {
  const asks = flags.map((f) => f.ask).filter(Boolean);
  const car = deal.vehicle || "the car";
  if (asks.length === 0) {
    return `Hi, thanks for the numbers on ${car}. Everything looks in line with the market, and I'm ready to move forward. Please send the final paperwork.`;
  }
  return [
    `Hi, I'm interested in ${car}, but I need a few changes before I can sign:`,
    "",
    ...asks.map((a) => `- ${a}`),
    "",
    "If you can make these changes, I'm ready to move forward today. Please send an updated buyer's order.",
  ].join("\n");
}

export function analyze(rawDeal, { creditTier, kbbValue } = {}) {
  if (!CREDIT_TIERS.includes(creditTier)) {
    throw new Error(`credit_tier must be one of: ${CREDIT_TIERS.join(", ")}`);
  }
  const deal = normalizeDeal(rawDeal);
  const kbb = num(kbbValue);

  const flags = [
    ...checkApr(deal, creditTier),
    ...checkPrice(deal, kbb),
    ...checkTerm(deal),
    ...checkAddOns(deal),
  ];

  const penalty = flags.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, 100 - penalty);
  const totalSavings = flags
    .filter((f) => f.severity === "red")
    .reduce((s, f) => s + f.dollar_impact, 0);

  return {
    score,
    verdict: verdictFor(score),
    total_savings: totalSavings,
    flags,
    counteroffer: buildCounteroffer(deal, flags),
    deal,
    inputs: { credit_tier: creditTier, kbb_value: kbb },
    disclaimer: DISCLAIMER,
  };
}
