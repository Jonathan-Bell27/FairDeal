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
// Contract math: gaps this small are rounding, not padding.
const AMOUNT_TOLERANCE = 25; // dollars of amount financed
const PAYMENT_TOLERANCE = { min: 2, share: 0.005 }; // per month: $2 or 0.5%, whichever is more
const NEGATIVE_EQUITY_MIN = 50;

const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(/[$,%\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const usd = (n) =>
  "$" + Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const sum = (list) => list.reduce((s, i) => s + i.amount, 0);

// What the itemized lines add up to: the amount financed if nothing else was added.
const itemizedTotal = (d) =>
  d.vehicle_price +
  sum(d.fees) +
  sum(d.add_ons) +
  sum(d.taxes_and_government_fees) +
  d.trade_in_payoff -
  d.trade_in_allowance -
  d.down_payment;

// Monthly payment for a fully amortizing loan.
export function monthlyPayment(principal, aprPercent, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

// The APR that turns this principal into this payment. The payment rises with
// the rate, so bisect.
function impliedApr(principal, payment, months) {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (monthlyPayment(principal, mid, months) < payment) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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
    deal.amount_financed = round2(itemizedTotal(deal));
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

// `loan` is the payment and total to compare against 60 months (see checkMath).
function checkTerm(deal, m, loan) {
  if (deal.term_months < TERM_CAUTION_MONTHS) return [];
  const packing = deal.term_months >= TERM_PACKING_MONTHS;
  const at60 = monthlyPayment(deal.amount_financed, deal.apr, 60);
  const extra = loan.total - at60 * 60;
  const t = m.term({
    total: deal.total_of_payments + deal.down_payment,
    price: deal.vehicle_price,
    overPrice: deal.total_of_payments + deal.down_payment - deal.vehicle_price,
    extra,
    at60,
    monthly: loan.payment,
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

// Checks the contract's own arithmetic, using only totals printed on it (the
// ones normalizeDeal fills in agree by construction). Also returns the payment
// and total the term check should use: the loan math's when the printed payment
// is padded, so the padding is counted once, here, and not again as interest.
function checkMath(deal, printed, m) {
  const flags = [];
  const loan = { payment: deal.monthly_payment, total: deal.total_of_payments };
  if (!printed.amount_financed) return { flags, loan };

  // A lower amount financed than the lines (a rebate, say) is not flagged.
  const itemized = itemizedTotal(deal);
  const unexplained = deal.amount_financed - itemized;
  if (deal.vehicle_price && unexplained > AMOUNT_TOLERANCE) {
    const t = m.unexplained({ gap: unexplained, itemized, financed: deal.amount_financed });
    flags.push(
      flag({
        id: "unexplained_amount",
        category: m.category.math,
        title: t.title,
        detail: t.detail,
        impact: unexplained,
        source: m.unexplainedSource,
        ask: t.ask,
        line: { label: t.label, charged: usd(deal.amount_financed), note: t.note, strike: false },
      }),
    );
  }

  if (printed.monthly_payment && deal.apr && deal.term_months) {
    const expected = monthlyPayment(deal.amount_financed, deal.apr, deal.term_months);
    const gap = deal.monthly_payment - expected;
    if (gap > Math.max(PAYMENT_TOLERANCE.min, expected * PAYMENT_TOLERANCE.share)) {
      const t = m.paymentGap({
        gap,
        expected,
        payment: deal.monthly_payment,
        financed: deal.amount_financed,
        apr: deal.apr,
        implied: impliedApr(deal.amount_financed, deal.monthly_payment, deal.term_months).toFixed(1),
        months: deal.term_months,
        total: gap * deal.term_months,
      });
      flags.push(
        flag({
          id: "payment_gap",
          category: m.category.math,
          title: t.title,
          detail: t.detail,
          impact: gap * deal.term_months,
          source: m.paymentGapSource,
          ask: t.ask,
          line: { label: t.label, charged: usd(deal.monthly_payment), note: t.note, strike: false },
        }),
      );
      loan.payment = expected;
      loan.total = expected * deal.term_months;
    }
  }
  return { flags, loan };
}

// Old-car debt rolled into this loan. Shown, not scored: it's the buyer's own
// loan, not a dealer charge, so there's nothing to ask the dealer to take off.
function checkNegativeEquity(deal, kbbValue, m) {
  const rolled = deal.trade_in_payoff - deal.trade_in_allowance;
  if (rolled <= NEGATIVE_EQUITY_MIN || !deal.term_months) return [];
  const interest = monthlyPayment(rolled, deal.apr, deal.term_months) * deal.term_months - rolled;
  const t = m.negativeEquity({
    rolled,
    payoff: deal.trade_in_payoff,
    allowance: deal.trade_in_allowance,
    interest,
    apr: deal.apr,
    months: deal.term_months,
    owed: deal.amount_financed,
    kbb: kbbValue,
    ltv: kbbValue ? Math.round((deal.amount_financed / kbbValue) * 100) : 0,
    upsideDown: Boolean(kbbValue) && deal.amount_financed > kbbValue,
  });
  return [
    flag({
      id: "negative_equity",
      category: m.category.tradeIn,
      title: t.title,
      detail: t.detail,
      impact: interest,
      source: m.negativeEquitySource,
      scored: false,
      line: { label: t.label, charged: usd(rolled), note: t.note, strike: false },
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

// The APR flag prices a lower rate at the contract's term, and the term flag
// prices 60 months at the contract's rate. Fixing both saves less than the two
// added together, because both cut the same interest. This is the part counted
// twice, so the total shows what fixing everything together would really save.
export function savingsOverlap(deal, creditTier, flags) {
  const scored = (id) => flags.some((f) => f.id === id && f.severity === "red");
  if (!scored("apr") || !scored("term")) return 0;
  const total = (apr, months) => monthlyPayment(deal.amount_financed, apr, months) * months;
  const fair = TYPICAL_APR[creditTier].apr;
  const n = deal.term_months;
  return Math.max(0, Math.round(total(deal.apr, n) - total(fair, n) - total(deal.apr, 60) + total(fair, 60)));
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

// The same deal with every scored line fixed: the KBB price, typical prices
// for overpriced items, the typical APR, a 60-month term, and none of the
// money the itemized lines don't explain. It is scored by these same rules, so
// Fix-It Mode shows a real result rather than a guess. Each scored flag's line
// gets `fixed`, the value it becomes.
function fairDeal(deal, creditTier, kbb, flags, lang, m) {
  const red = flags.filter((f) => f.severity === "red");
  if (!red.length) return null;
  const has = (id) => red.some((f) => f.id === id);
  const typical = TYPICAL_APR[creditTier].apr;
  const fixed = structuredClone(deal);
  const itemFix = new Map(); // item name -> typical price
  let cut = 0;

  if (has("price")) {
    cut += deal.vehicle_price - kbb;
    fixed.vehicle_price = kbb;
  }
  for (const list of ["fees", "add_ons"]) {
    fixed[list] = deal[list].map((item) => {
      const rule = ADD_ONS.find((r) => r.match.test(item.name));
      if (!rule || rule.financed || !red.some((f) => f.line?.label === item.name)) return item;
      itemFix.set(item.name, rule.fair);
      cut += item.amount - rule.fair;
      return { ...item, amount: rule.fair };
    });
  }
  cut += red.find((f) => f.id === "unexplained_amount")?.dollar_impact ?? 0;
  if (has("apr")) fixed.apr = typical;
  if (has("term")) fixed.term_months = 60;

  // Financed deals keep the contract's amount financed minus the fixes, so
  // rebates the lines don't show still count. The payment is recomputed.
  const financed = deal.amount_financed > 0 && deal.term_months > 0;
  fixed.amount_financed = financed ? Math.max(0, round2(deal.amount_financed - cut)) : 0;
  fixed.monthly_payment = 0;
  fixed.total_of_payments = 0;
  const after = analyze(fixed, { creditTier, kbbValue: kbb, lang, fair: false });

  for (const f of red) {
    let to = m.fixedExplain;
    if (f.id === "price") to = usd(kbb);
    else if (f.id === "apr") to = `${typical}%`;
    else if (f.id === "term") to = m.fixedTerm(60);
    else if (itemFix.has(f.line?.label)) to = itemFix.get(f.line.label) ? usd(itemFix.get(f.line.label)) : m.fixedRemoved;
    f.line = { ...f.line, fixed: to };
  }

  const itemsTotal = (d) =>
    d.vehicle_price + [...d.fees, ...d.add_ons, ...d.taxes_and_government_fees].reduce((s, i) => s + i.amount, 0);
  return {
    score: after.score,
    verdict: after.verdict,
    financed,
    apr: fixed.apr,
    term_months: fixed.term_months,
    monthly_payment: financed ? after.deal.monthly_payment : 0,
    total_of_payments: financed ? after.deal.total_of_payments : 0,
    // Cash deals: the itemized total before and after.
    price_total: round2(itemsTotal(deal)),
    fair_price_total: round2(itemsTotal(fixed)),
  };
}

export function analyze(rawDeal, { creditTier, kbbValue, lang = "en", fair = true } = {}) {
  if (!LANGS.includes(lang)) lang = "en";
  const m = messages(lang);
  if (!CREDIT_TIERS.includes(creditTier)) {
    throw new Error(`credit_tier must be one of: ${CREDIT_TIERS.join(", ")}`);
  }
  // normalizeDeal fills in totals the document didn't show, so note which were printed.
  const printed = {
    amount_financed: num(rawDeal?.amount_financed) > 0,
    monthly_payment: num(rawDeal?.monthly_payment) > 0,
  };
  const deal = normalizeDeal(rawDeal);
  const kbb = num(kbbValue);
  const math = checkMath(deal, printed, m);

  const flags = [
    ...checkApr(deal, creditTier, m),
    ...checkPrice(deal, kbb, m),
    ...checkTerm(deal, m, math.loan),
    ...checkAddOns(deal, m, lang),
    ...math.flags,
    ...checkNegativeEquity(deal, kbb, m),
  ];

  const penalty = flags.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, 100 - penalty);
  const overlap = savingsOverlap(deal, creditTier, flags);
  const totalSavings = flags
    .filter((f) => f.severity === "red")
    .reduce((s, f) => s + f.dollar_impact, 0) - overlap;

  return {
    score,
    verdict: verdictFor(score, lang),
    total_savings: totalSavings,
    savings_overlap: overlap,
    fair: fair ? fairDeal(deal, creditTier, kbb, flags, lang, m) : null,
    flags,
    counteroffer: buildCounteroffer(deal, flags, lang),
    deal,
    inputs: { credit_tier: creditTier, kbb_value: kbb, lang },
    disclaimer: m.disclaimer,
  };
}
