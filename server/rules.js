// Deterministic rules engine. Claude only reads the document; every flag,
// dollar amount, and score comes from here so it can be explained and cited.

import {
  ADD_ONS,
  APR_TOLERANCE,
  HIGH_MILEAGE,
  PRICE_TOLERANCE,
  TERM_CAUTION_MONTHS,
  TERM_PACKING_MONTHS,
  TYPICAL_APR,
} from "./data/lookups.js";
import { LANGS, messages } from "./i18n.js";

export const CREDIT_TIERS = Object.keys(TYPICAL_APR);
export const DISCLAIMER = messages("en").disclaimer;

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

// `line` is the contract line item as the Results screen marks it up:
// { label, charged, note, strike } where note is the short red-pen correction.
function flag({ id, category, title, detail, impact, source, scored = true, ask, line }) {
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
    line,
  };
}

function checkApr(deal, tier, m) {
  const typical = TYPICAL_APR[tier];
  if (!typical || !deal.apr || !deal.term_months) return [];
  if (deal.apr <= typical.apr + APR_TOLERANCE) return [];

  const actualTotal = monthlyPayment(deal.amount_financed, deal.apr, deal.term_months) * deal.term_months;
  const fairTotal = monthlyPayment(deal.amount_financed, typical.apr, deal.term_months) * deal.term_months;
  const extra = actualTotal - fairTotal;
  const t = m.apr({
    apr: deal.apr,
    gap: (deal.apr - typical.apr).toFixed(1),
    tier: m.tier[tier],
    typical: typical.apr,
    experianTier: typical.experianTier,
    extra,
    months: deal.term_months,
  });

  return [
    flag({
      id: "apr",
      category: m.category.apr,
      title: t.title,
      detail: t.detail,
      impact: extra,
      source: m.aprSource,
      ask: t.ask,
      line: { label: "APR", charged: `${deal.apr}%`, note: t.note, strike: false },
    }),
  ];
}

function checkAddOns(deal, m, lang) {
  const flags = [];
  const seen = new Set();
  for (const item of [...deal.fees, ...deal.add_ons]) {
    const rule = ADD_ONS.find((r) => r.match.test(item.name));
    if (!rule || item.amount <= rule.flagAbove) continue;
    const id = seen.has(rule.key) ? `${rule.key}_${seen.size}` : rule.key;
    seen.add(rule.key);
    const why = (lang === "es" && rule.why_es) || rule.why;
    const source = (lang === "es" && rule.source_es) || rule.source;
    if (rule.financed) {
      const interest = monthlyPayment(item.amount, deal.apr, deal.term_months) * deal.term_months - item.amount;
      const t = m.financed({ name: item.name, amount: item.amount, interest, apr: deal.apr, months: deal.term_months, why });
      flags.push(
        flag({
          id,
          category: m.category.addOns,
          title: t.title,
          detail: t.detail,
          impact: interest,
          source,
          scored: false,
          ask: t.ask,
          line: { label: item.name, charged: usd(item.amount), note: t.note, strike: false },
        }),
      );
      continue;
    }
    const impact = item.amount - rule.fair;
    const remove = rule.fair === 0;
    flags.push(
      flag({
        id,
        category: m.category.addOns,
        title: remove ? m.addOnTitleRemove(item.name, item.amount) : m.addOnTitleCompare(item.name, item.amount, rule.fair),
        detail: why,
        impact,
        source,
        ask: rule.key === "doc_fee"
          ? m.askDocFee(item.name, impact, rule.fair)
          : remove || rule.key === "vin_etch" || rule.key === "paint_protection"
            ? m.askRemove(item.name, item.amount)
            : m.askLower(item.name, item.amount, rule.fair),
        line: {
          label: item.name,
          charged: usd(item.amount),
          note: remove ? m.noteRemove : rule.key === "doc_fee" ? m.noteDocFee(rule.fair) : m.noteElsewhere(rule.fair),
          strike: rule.key !== "doc_fee",
        },
      }),
    );
  }
  return flags;
}

function checkTerm(deal, m) {
  if (deal.term_months < TERM_CAUTION_MONTHS) return [];
  const packing = deal.term_months >= TERM_PACKING_MONTHS;
  const at60 = monthlyPayment(deal.amount_financed, deal.apr, 60);
  const extra = deal.total_of_payments - at60 * 60;
  const t = m.term({
    total: deal.total_of_payments + deal.down_payment,
    price: deal.vehicle_price,
    overPrice: deal.total_of_payments + deal.down_payment - deal.vehicle_price,
    extra,
    at60,
    monthly: deal.monthly_payment,
    miles: deal.mileage,
    highMiles: deal.mileage >= HIGH_MILEAGE,
    packing,
    months: deal.term_months,
  });

  return [
    flag({
      id: "term",
      category: m.category.term,
      title: t.title,
      detail: t.detail,
      impact: extra,
      source: m.termSource,
      scored: packing,
      ask: t.ask,
      line: { label: t.label, charged: t.charged, note: t.note, strike: false },
    }),
  ];
}

function checkPrice(deal, kbbValue, m) {
  if (!kbbValue || !deal.vehicle_price) return [];
  const over = deal.vehicle_price - kbbValue;
  if (over <= PRICE_TOLERANCE) return [];
  const t = m.price({ over, price: deal.vehicle_price, kbb: kbbValue });
  return [
    flag({
      id: "price",
      category: m.category.price,
      title: t.title,
      detail: t.detail,
      impact: over,
      source: m.priceSource,
      ask: t.ask,
      line: { label: t.label, charged: usd(deal.vehicle_price), note: t.note, strike: false },
    }),
  ];
}

export function verdictFor(score, lang = "en") {
  const key = score >= 85 ? "fair" : score >= 60 ? "negotiate" : "walk";
  return { key, label: messages(lang).verdict[key] };
}

export function buildCounteroffer(deal, flags, lang = "en") {
  const m = messages(lang);
  const asks = flags.map((f) => f.ask).filter(Boolean);
  const car = deal.vehicle || m.theCar;
  if (asks.length === 0) return m.counterClean(car);
  return [m.counterIntro(car), "", ...asks.map((a) => `- ${a}`), "", m.counterOutro].join("\n");
}

export function analyze(rawDeal, { creditTier, kbbValue, lang = "en" } = {}) {
  if (!LANGS.includes(lang)) lang = "en";
  const m = messages(lang);
  if (!CREDIT_TIERS.includes(creditTier)) {
    throw new Error(`credit_tier must be one of: ${CREDIT_TIERS.join(", ")}`);
  }
  const deal = normalizeDeal(rawDeal);
  const kbb = num(kbbValue);

  const flags = [
    ...checkApr(deal, creditTier, m),
    ...checkPrice(deal, kbb, m),
    ...checkTerm(deal, m),
    ...checkAddOns(deal, m, lang),
  ];

  const penalty = flags.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, 100 - penalty);
  const totalSavings = flags
    .filter((f) => f.severity === "red")
    .reduce((s, f) => s + f.dollar_impact, 0);

  return {
    score,
    verdict: verdictFor(score, lang),
    total_savings: totalSavings,
    flags,
    counteroffer: buildCounteroffer(deal, flags, lang),
    deal,
    inputs: { credit_tier: creditTier, kbb_value: kbb, lang },
    disclaimer: m.disclaimer,
  };
}
