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

// Claude quotes specific clauses from the paperwork; the server explains them in `lang`.
export function readFinePrint(file, lang) {
  const form = new FormData();
  form.append("file", file);
  form.append("lang", lang);
  return request("/fineprint", { method: "POST", body: form }, lang);
}

// Re-explains clauses already read, in another language. No new Claude call.
export function explainFinePrint(clauses, lang) {
  return request(
    "/fineprint",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clauses, lang }),
    },
    lang,
  );
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

// POST that answers with server-sent events. Calls onEvent(name, data) for each
// event until the server closes the stream. Rejects on HTTP or network errors.
export async function postStream(path, body, onEvent, { lang = "en", signal } = {}) {
  const errors = (STRINGS[lang] ?? STRINGS.en).errors;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(errors.network);
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || errors.failed(res.status));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

export function streamAdvice({ deal, creditTier, kbbValue, lang, profile }, onEvent, signal) {
  return postStream(
    "/advise",
    { deal, credit_tier: creditTier, kbb_value: kbbValue, lang, profile },
    onEvent,
    { lang, signal },
  );
}

export function streamChat({ mode, deal, creditTier, kbbValue, lang, report, messages }, onEvent, signal) {
  return postStream(
    "/chat",
    { mode, deal, credit_tier: creditTier, kbb_value: kbbValue, lang, report, messages },
    onEvent,
    { lang, signal },
  );
}
