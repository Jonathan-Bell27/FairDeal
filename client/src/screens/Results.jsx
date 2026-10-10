import { usd } from "../format.js";

export default function Results({ result, onEdit, onCounter }) {
  const { score, verdict, total_savings, flags, disclaimer } = result;
  const red = flags.filter((f) => f.severity === "red");
  const caution = flags.filter((f) => f.severity !== "red");

  return (
    <section className="screen">
      <div className={`score-card ${verdict.key}`}>
        <div className="score">
          {score}
          <small>/100</small>
        </div>
        <div className="verdict">{verdict.label}</div>
        {total_savings > 0 && (
          <div className="savings">
            You could save <strong>{usd(total_savings)}</strong>
          </div>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="card">
          <h3>No red flags found</h3>
          <p className="muted">The rate, price, term, and fees look in line with typical deals.</p>
        </div>
      ) : (
        <>
          <h2 className="section-title">
            {red.length} red flag{red.length === 1 ? "" : "s"}
          </h2>
          {red.map((f) => (
            <Flag key={f.id} flag={f} />
          ))}
          {caution.length > 0 && <h2 className="section-title">Worth a look</h2>}
          {caution.map((f) => (
            <Flag key={f.id} flag={f} />
          ))}
        </>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={onCounter}>
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

function Flag({ flag }) {
  return (
    <article className={`flag ${flag.severity}`}>
      <div className="flag-head">
        <span className="tag">{flag.category}</span>
        {flag.dollar_impact > 0 && <span className="impact">{usd(flag.dollar_impact)}</span>}
      </div>
      <h3>{flag.title}</h3>
      <p>{flag.detail}</p>
      <p className="source">Source: {flag.source}</p>
    </article>
  );
}
