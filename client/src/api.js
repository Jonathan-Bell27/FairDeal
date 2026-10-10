// Calls to the FairDeal backend. See server/README.md for the full contract.

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
async function request(path, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The server took too long to respond. Try again or enter the terms manually.");
    if (err instanceof TypeError) throw new Error("Couldn't reach the server. Check your connection and try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Fire and forget on page load so the server is awake by the time the photo is ready.
export function wakeServer() {
  fetch(`${API_URL}/health`).catch(() => {});
}

export function extractDeal(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/extract", { method: "POST", body: form });
}

export function analyzeDeal(deal, creditTier, kbbValue) {
  return request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal, credit_tier: creditTier, kbb_value: kbbValue }),
  });
}
