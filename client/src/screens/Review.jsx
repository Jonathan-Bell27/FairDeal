import { CREDIT_TIERS } from "../api.js";
import { useT } from "../i18n.js";

// Also the manual entry form: it starts from an empty deal. Labels live in i18n.js.
const FIELDS = [
  ["Vehicle", [["vehicle", "text"], ["mileage", "number"], ["vehicle_price", "number"]]],
  [
    "Loan",
    [
      ["apr", "number"],
      ["term_months", "number"],
      ["monthly_payment", "number"],
      ["down_payment", "number"],
      ["trade_in_allowance", "number"],
      ["trade_in_payoff", "number"],
      ["amount_financed", "number"],
      ["total_of_payments", "number"],
    ],
  ],
];

const LISTS = ["fees", "add_ons", "taxes_and_government_fees"];

export default function Review({
  deal, setDeal, creditTier, setCreditTier, kbbValue, setKbbValue, note, onAnalyze, analyzing, error,
}) {
  const t = useT();
  const r = t.review;
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
      <p className="eyebrow">{r.eyebrow}</p>
      <h1>{r.title}</h1>
      <p className="lede">{note || r.lede}</p>

      <div className="card">
        <div className="row">
          <label className="field">
            <span>{t.upload.credit}</span>
            <select value={creditTier} onChange={(e) => setCreditTier(e.target.value)}>
              {CREDIT_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {t.tiers[tier]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{r.kbb}</span>
            <input inputMode="decimal" value={kbbValue} onChange={(e) => setKbbValue(e.target.value)} placeholder={r.optional} />
          </label>
        </div>
      </div>

      {FIELDS.map(([title, fields]) => (
        <div className="card" key={title}>
          <h3>{r.groups[title]}</h3>
          <div className="grid">
            {fields.map(([key, type]) => (
              <label className={`field ${key === "vehicle" ? "wide" : ""}`} key={key}>
                <span>{r.fields[key]}</span>
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

      {LISTS.map((list) => (
        <div className="card" key={list}>
          <h3>{r.lists[list][0]}</h3>
          {deal[list].length === 0 && <p className="muted small">{r.none}</p>}
          {deal[list].map((item, i) => (
            <div className="item-row" key={i}>
              <input
                aria-label={r.itemName}
                placeholder={r.lists[list][1]}
                value={item.name}
                onChange={(e) => setItem(list, i, "name", e.target.value)}
              />
              <input
                aria-label={r.amount}
                className="amount"
                inputMode="decimal"
                placeholder="$"
                value={shown(item.amount)}
                onChange={(e) => setItem(list, i, "amount", e.target.value)}
              />
              <button
                className="icon"
                aria-label={r.removeNamed(item.name)}
                data-tooltip={r.remove}
                onClick={() => removeItem(list, i)}
              >
                ×
              </button>
            </div>
          ))}
          <button className="link" onClick={() => addItem(list)}>
            {r.add}
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
          {analyzing ? r.checking : canAnalyze ? r.check : r.needPrice}
        </button>
      </div>
    </section>
  );
}
