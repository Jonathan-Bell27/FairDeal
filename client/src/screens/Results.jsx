import { usd } from "../format.js";
import { PenCircle } from "../Pen.jsx";

const STAMP = { fair: "Fair deal", negotiate: "Negotiate", walk: "Walk away" };

const VERDICT_SUB = {
  fair: "Rate, price, term and fees check out.",
  negotiate: "Fix these before you sign.",
  walk: "Don't sign this as written.",
};

export default function Results({ result, onEdit, onCounter }) {
  const { score, verdict, total_savings, flags, disclaimer } = result;
  // Red flags first, biggest dollar amount first; cautions after.
  const lines = [...flags].sort(
    (a, b) => (a.severity === "red" ? 0 : 1) - (b.severity === "red" ? 0 : 1) || b.dollar_impact - a.dollar_impact,
  );

  return (
    <section className="screen">
      <p className="eyebrow">Your deal, marked up</p>

      <div className="sheet verdict-sheet">
        <div className={`score-mark ${verdict.key}`}>
          <PenCircle />
          <div className={`score ${score >= 100 ? "long" : ""}`}>
            {score}
            <small>OF 100</small>
          </div>
        </div>
        <div className={`stamp ${verdict.key}`}>{STAMP[verdict.key] ?? verdict.label}</div>
        <div className="verdict-sub">{VERDICT_SUB[verdict.key]}</div>
        {total_savings > 0 ? (
          <div className="keep">{usd(total_savings)} you could keep</div>
        ) : (
          <div className="keep fair">Nothing to mark up ✓</div>
        )}
      </div>

      {lines.length > 0 && (
        <>
          <h2 className="section-title">What we marked · tap a line for why</h2>
          <div className="sheet receipt">
            {lines.map((f, i) => (
              <Line key={f.id} flag={f} index={i} />
            ))}
            {total_savings > 0 && (
              <div className="total">
                <span>You could keep</span>
                <strong>{usd(total_savings)}</strong>
              </div>
            )}
          </div>
        </>
      )}


      <div className="actions">
        <button className="btn red big" onClick={onCounter}>
          {flags.length ? "Write my counteroffer" : "Write a message to the dealer"}
        </button>
        <button className="btn" onClick={onEdit}>
          Edit the numbers
        </button>
      </div>

      <p className="disclaimer">{disclaimer}</p>
    </section>
  );
}

function Line({ flag, index }) {
  // Fallback for responses from an older server without `line`.
  const line = flag.line ?? { label: flag.title, charged: "", note: "", strike: false };
  const scored = flag.severity === "red";
  return (
    <details className={`line ${scored ? "red" : "caution"}`}>
      <summary>
        <div className="line-top">
          <span className="line-label">{line.label}</span>
          <span className="leader" aria-hidden="true" />
          {line.charged && (
            <span className={`charged ${line.strike ? "strike" : ""}`} style={{ "--i": index }}>
              {line.charged}
            </span>
          )}
        </div>
        <div className="line-note">
          <span>
            <span aria-hidden="true">↳ </span>
            {line.note}
          </span>
          {scored && flag.dollar_impact > 0 && <span className="impact">−{usd(flag.dollar_impact)}</span>}
        </div>
        <div className="line-more">{scored ? "Why?" : "Not counted in your score · Why?"}</div>
      </summary>
      <div className="line-detail">
        <p>
          <strong>{flag.title}.</strong> {flag.detail}
        </p>
        <p className="source">Source: {flag.source}</p>
      </div>
    </details>
  );
}
