// Calls to the FairDeal backend. See server/README.md for the full contract.
import { STRINGS } from "./i18n.js";

export const API_URL = (import.meta.env.VITE_API_URL || "https://fairdeal-jamn.onrender.com").replace(/\/$/, "");

export const CREDIT_TIERS = ["Excellent", "Good", "Fair", "Poor"];

export const emptyDeal = () => ({
  document_type: "",
  vehicle: "",
  mileage: 0,
  vehicle_price: 0,
  apr: 0,
  term_months: 0,
  down_payment: 0,
  trade_in_allowance: 0,
  trade_in_payoff: 0,
  monthly_payment: 0,
  amount_financed: 0,
  total_of_payments: 0,
  fees: [],
  add_ons: [],
  taxes_and_government_fees: [],
});

// The free Render server can take ~50s to wake up, so allow plenty of time.
async function request(path, options = {}, lang = "en", timeoutMs = 90000) {
  const errors = (STRINGS[lang] ?? STRINGS.en).errors;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || errors.failed(res.status));
    return body;
  } catch (err) {
    if (err.name === "AbortError") throw new Error(errors.timeout);
    if (err instanceof TypeError) throw new Error(errors.network);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Fire and forget on page load so the server is awake by the time the photo is ready.
export function wakeServer() {
  fetch(`${API_URL}/health`).catch(() => {});
}

export function extractDeal(file, lang) {
  const form = new FormData();
  form.append("file", file);
  return request("/extract", { method: "POST", body: form }, lang);
}

export function analyzeDeal(deal, creditTier, kbbValue, lang) {
  return request(
    "/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal, credit_tier: creditTier, kbb_value: kbbValue, lang }),
    },
    lang,
  );
}
