import { CREDIT_TIERS } from "../api.js";

// Also the manual entry form: it starts from an empty deal.
const FIELDS = [
  ["Vehicle", [
    ["vehicle", "Vehicle", "text"],
    ["mileage", "Mileage", "number"],
    ["vehicle_price", "Vehicle price ($)", "number"],
  ]],
  ["Loan", [
    ["apr", "APR (%)", "number"],
    ["term_months", "Term (months)", "number"],
    ["monthly_payment", "Monthly payment ($)", "number"],
    ["down_payment", "Down payment ($)", "number"],
    ["trade_in_allowance", "Trade-in allowance ($)", "number"],
    ["trade_in_payoff", "Trade-in payoff ($)", "number"],
    ["amount_financed", "Amount financed ($)", "number"],
    ["total_of_payments", "Total of payments ($)", "number"],
  ]],
];

const LISTS = [
  ["fees", "Dealer fees", "e.g. Doc fee"],
  ["add_ons", "Add-ons & protection products", "e.g. GAP, VIN etching"],
  ["taxes_and_government_fees", "Taxes & government fees", "e.g. Sales tax"],
];

export default function Review({
  deal, setDeal, creditTier, setCreditTier, kbbValue, setKbbValue, note, onAnalyze, analyzing, error,
}) {
  const set = (key, value) => setDeal({ ...deal, [key]: value });
  const setItem = (list, i, key, value) =>
    set(list, deal[list].map((item, j) => (j === i ? { ...item, [key]: value } : item)));
  const addItem = (list) => set(list, [...deal[list], { name: "", amount: "" }]);
  const removeItem = (list, i) => set(list, deal[list].filter((_, j) => j !== i));

  // Show blanks instead of 0 so the manual form is easy to fill in.
  const shown = (v) => (v === 0 ? "" : v);
  const canAnalyze = Number(String(deal.vehicle_price).replace(/[$,]/g, "")) > 0;

  return (
    <section className="screen">
      <h1>Check the numbers</h1>
      <p className="lede">{note || "Enter what's on your buyer's order or loan offer. Leave blank anything you don't see."}</p>

      <div className="card">
        <div className="row">
          <label className="field">
            <span>Your credit</span>
            <select value={creditTier} onChange={(e) => setCreditTier(e.target.value)}>
              {CREDIT_TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>KBB value ($)</span>
            <input inputMode="decimal" value={kbbValue} onChange={(e) => setKbbValue(e.target.value)} placeholder="optional" />
          </label>
        </div>
      </div>

      {FIELDS.map(([title, fields]) => (
        <div className="card" key={title}>
          <h3>{title}</h3>
          <div className="grid">
            {fields.map(([key, label, type]) => (
              <label className={`field ${key === "vehicle" ? "wide" : ""}`} key={key}>
                <span>{label}</span>
                <input
                  inputMode={type === "number" ? "decimal" : "text"}
                  value={shown(deal[key])}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      {LISTS.map(([list, title, placeholder]) => (
        <div className="card" key={list}>
          <h3>{title}</h3>
          {deal[list].length === 0 && <p className="muted small">None listed.</p>}
          {deal[list].map((item, i) => (
            <div className="item-row" key={i}>
              <input
                aria-label="Item name"
                placeholder={placeholder}
                value={item.name}
                onChange={(e) => setItem(list, i, "name", e.target.value)}
              />
              <input
                aria-label="Amount"
                className="amount"
                inputMode="decimal"
                placeholder="$"
                value={shown(item.amount)}
                onChange={(e) => setItem(list, i, "amount", e.target.value)}
              />
              <button className="icon" aria-label="Remove item" onClick={() => removeItem(list, i)}>
                ×
              </button>
            </div>
          ))}
          <button className="link" onClick={() => addItem(list)}>
            + Add item
          </button>
        </div>
      ))}

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <div className="actions sticky">
        <button className="btn primary big" onClick={onAnalyze} disabled={analyzing || !canAnalyze}>
          {analyzing ? "Checking…" : canAnalyze ? "Check this deal" : "Enter the vehicle price to continue"}
        </button>
      </div>
    </section>
  );
}
