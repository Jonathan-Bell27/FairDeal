import { useState } from "react";
import { usd } from "../format.js";
import { useT } from "../i18n.js";
import Dial from "../Dial.jsx";
import { useCountUp } from "../useCountUp.js";
import FinePrint from "./FinePrint.jsx";

export default function Results({
  result,
  onEdit,
  onCounter,
  onShare,
  shared,
  onStartOver,
  profile,
  setProfile,
  onAdvise,
  hasReport,
  onChat,
  onPractice,
}) {
  const t = useT().results;
  const { score, verdict, total_savings, flags, disclaimer, fair } = result;
  // Fix-It Mode: show the deal with every marked line fixed.
  const [fixing, setFixing] = useState(false);
  const fixOn = fixing && Boolean(fair);
  const shownScore = fixOn ? fair.score : score;
  const shownVerdict = fixOn ? fair.verdict : verdict;
  // Red flags first, biggest dollar amount first; cautions after.
  const lines = [...flags].sort(
    (a, b) => (a.severity === "red" ? 0 : 1) - (b.severity === "red" ? 0 : 1) || b.dollar_impact - a.dollar_impact,
  );

  return (
    <section className="screen">
      {shared && (
        <div className="shared-banner" role="status">
          <p>{t.sharedBanner}</p>
          <button className="link" onClick={onStartOver}>
            {t.checkOwn}
          </button>
        </div>
      )}
      <p className="eyebrow">{t.eyebrow}</p>

      <div className="sheet verdict-sheet">
        <Dial score={shownScore} label={t.dialLabel(shownScore)} ofText={t.scoreOf} />
        <div className="verdict-text">
          <div key={shownVerdict.key} className={`stamp ${shownVerdict.key}`}>
            {t.stamp[shownVerdict.key] ?? shownVerdict.label}
          </div>
          <div className="verdict-sub">{fixOn ? t.fix.sub : t.sub[verdict.key]}</div>
        </div>
        {fixOn ? (
          <FixSummary deal={result.deal} fair={fair} t={t.fix} />
        ) : total_savings > 0 ? (
          <div className="keep">{t.keep(usd(total_savings))}</div>
        ) : (
          <div className="keep fair">{t.clean}</div>
        )}
      </div>

      {fair && (
        <button
          className={`btn fix-toggle ${fixOn ? "on" : ""}`}
          aria-pressed={fixOn}
          onClick={() => setFixing((on) => !on)}
        >
          {fixOn ? t.fix.hide : t.fix.show}
        </button>
      )}

      {lines.length > 0 && (
        <>
          <h2 className="section-title">{t.marked}</h2>
          <div className="sheet receipt">
            {lines.map((f, i) => (
              <Line key={f.id} flag={f} index={i} t={t} fixing={fixOn} />
            ))}
            {result.savings_overlap > 0 && (
              <div className="overlap">
                <span>{t.overlap}</span>
                <span className="overlap-amount">+{usd(result.savings_overlap)}</span>
              </div>
            )}
            {total_savings > 0 && (
              <div className="total">
                <span>{t.total}</span>
                <strong>{usd(total_savings)}</strong>
              </div>
            )}
          </div>
        </>
      )}

      <FinePrint />

      <div className="actions">
        <button className="btn red big" onClick={onCounter}>
          {flags.length ? t.counter : t.message}
        </button>
        {onShare && (
          <button className="btn" onClick={onShare}>
            {t.share}
          </button>
        )}
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

// What the fair version changes: payment, length and rate for a loan, or the
// itemized total for a cash deal. The new payment rolls down as it appears.
function FixSummary({ deal, fair, t }) {
  const payment = useCountUp(fair.monthly_payment);
  const total = useCountUp(fair.fair_price_total);
  const rows = fair.financed
    ? [
        [t.payment, `${usd(deal.monthly_payment)}`, `${usd(payment)}`],
        fair.term_months !== deal.term_months && [t.term, t.months(deal.term_months), t.months(fair.term_months)],
        fair.apr !== deal.apr && [t.rate, `${deal.apr}%`, `${fair.apr}%`],
      ]
    : [[t.total, usd(fair.price_total), usd(total)]];
  return (
    <div className="fix-summary">
      {rows.filter(Boolean).map(([label, from, to]) => (
        <div className="fix-row" key={label}>
          <span>{label}</span>
          <span>
            <s>{from}</s> <strong>{to}</strong>
          </span>
        </div>
      ))}
      <p className="fix-note">{t.note}</p>
    </div>
  );
}

function Line({ flag, index, t, fixing }) {
  // Fallback for responses from an older server without `line`.
  const line = flag.line ?? { label: flag.title, charged: "", note: "", strike: false };
  const scored = flag.severity === "red";
  const fixed = fixing && scored && line.fixed;
  return (
    <details className={`line ${scored ? "red" : "caution"} ${fixed ? "fixing" : ""}`}>
      <summary>
        <div className="line-top">
          <span className="line-label">{line.label}</span>
          <span className="leader" aria-hidden="true" />
          {line.charged && (
            <span className={`charged ${line.strike || fixed ? "strike" : ""}`} style={{ "--i": index }}>
              {line.charged}
            </span>
          )}
          {fixed && (
            <span className="fixed-to" style={{ "--i": index }}>
              → {line.fixed}
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
