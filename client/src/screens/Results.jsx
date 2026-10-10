import { usd } from "../format.js";
import { useT } from "../i18n.js";
import Dial from "../Dial.jsx";

export default function Results({ result, onEdit, onCounter, profile, setProfile, onAdvise, hasReport, onChat, onPractice }) {
  const t = useT().results;
  const { score, verdict, total_savings, flags, disclaimer } = result;
  // Red flags first, biggest dollar amount first; cautions after.
  const lines = [...flags].sort(
    (a, b) => (a.severity === "red" ? 0 : 1) - (b.severity === "red" ? 0 : 1) || b.dollar_impact - a.dollar_impact,
  );

  return (
    <section className="screen">
      <p className="eyebrow">{t.eyebrow}</p>

      <div className="sheet verdict-sheet">
        <Dial score={score} label={t.dialLabel(score)} ofText={t.scoreOf} />
        <div className="verdict-text">
          <div className={`stamp ${verdict.key}`}>{t.stamp[verdict.key] ?? verdict.label}</div>
          <div className="verdict-sub">{t.sub[verdict.key]}</div>
        </div>
        {total_savings > 0 ? (
          <div className="keep">{t.keep(usd(total_savings))}</div>
        ) : (
          <div className="keep fair">{t.clean}</div>
        )}
      </div>

      {lines.length > 0 && (
        <>
          <h2 className="section-title">{t.marked}</h2>
          <div className="sheet receipt">
            {lines.map((f, i) => (
              <Line key={f.id} flag={f} index={i} t={t} />
            ))}
            {total_savings > 0 && (
              <div className="total">
                <span>{t.total}</span>
                <strong>{usd(total_savings)}</strong>
              </div>
            )}
          </div>
        </>
      )}

      <div className="actions">
        <button className="btn red big" onClick={onCounter}>
          {flags.length ? t.counter : t.message}
        </button>
        <button className="btn" onClick={onEdit}>
          {t.edit}
        </button>
      </div>

      {onAdvise && (
        <DeepDive
          profile={profile}
          setProfile={setProfile}
          onStart={onAdvise}
          hasReport={hasReport}
          onChat={onChat}
          onPractice={onPractice}
        />
      )}

      <p className="disclaimer">{disclaimer}</p>
    </section>
  );
}

// Optional questions that let Claude tailor the research and plan to this buyer.
function DeepDive({ profile, setProfile, onStart, hasReport, onChat, onPractice }) {
  const t = useT().deep;
  const set = (key) => (e) => setProfile({ ...profile, [key]: e.target.value });
  return (
    <section className="sheet deep-dive" aria-labelledby="deep-title">
      <p className="eyebrow">{t.eyebrow}</p>
      <h2 id="deep-title">{t.title}</h2>
      <p className="muted">{t.lede}</p>
      <div className="grid">
        <label className="field">
          <span>{t.zip}</span>
          <input inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="30303" value={profile.zip} onChange={set("zip")} />
        </label>
        <label className="field">
          <span>{t.income}</span>
          <input inputMode="decimal" placeholder="3,800" value={profile.monthly_income} onChange={set("monthly_income")} />
        </label>
        <label className="field wide">
          <span>{t.keep}</span>
          <select value={profile.keep_years} onChange={set("keep_years")}>
            <option value="">{t.keepSkip}</option>
            <option value="2">{t.keepShort}</option>
            <option value="4">{t.keepMid}</option>
            <option value="7">{t.keepLong}</option>
          </select>
        </label>
        <label className="field wide">
          <span>
            {t.notes} <em>{t.optional}</em>
          </span>
          <textarea rows={2} maxLength={500} placeholder={t.notesPlaceholder} value={profile.notes} onChange={set("notes")} />
        </label>
      </div>
      <p className="hint">{t.privacy}</p>
      <div className="actions">
        <button className="btn primary big" onClick={onStart}>
          {hasReport ? t.view : t.start}
        </button>
      </div>
      {(onChat || onPractice) && (
        <p className="quick-links">
          {t.or}{" "}
          {onChat && (
            <button className="link" onClick={onChat}>
              {t.ask}
            </button>
          )}
          {onChat && onPractice && " · "}
          {onPractice && (
            <button className="link" onClick={onPractice}>
              {t.practice}
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function Line({ flag, index, t }) {
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
        <div className="line-more">{scored ? t.why : t.notCounted}</div>
      </summary>
      <div className="line-detail">
        <p>
          <strong>{flag.title}.</strong> {flag.detail}
        </p>
        <p className="source">
          {t.source}: {flag.source}
        </p>
      </div>
    </details>
  );
}
