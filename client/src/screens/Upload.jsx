import { useContext, useEffect, useRef, useState } from "react";
import { CREDIT_TIERS, extractDeal, readFinePrint } from "../api.js";
import { LangContext, useT } from "../i18n.js";
import { prepareUpload } from "../image.js";
import { PenCircle } from "../Pen.jsx";

export default function Upload({ creditTier, setCreditTier, kbbValue, setKbbValue, onExtracted, onManual, notice }) {
  const lang = useContext(LangContext);
  const t = useT();
  const u = t.upload;
  const cameraInput = useRef(null);
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");

  // After 10s, explain the wait (usually the free server waking up).
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, [busy]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setSlow(false);
    setBusy(true);
    setError("");
    try {
      const upload = await prepareUpload(file);
      // The fine print is read alongside the numbers; the Review screen doesn't wait for it.
      const finePrint = readFinePrint(upload, lang);
      finePrint.catch(() => {}); // a failed read only hides the fine print section
      const { deal, ms } = await extractDeal(upload, lang);
      onExtracted(deal, ms, finePrint);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <section className="screen" aria-busy="true" aria-live="polite">
        <p className="eyebrow">{u.readingEyebrow}</p>
        <h1>{u.reading}</h1>
        <p className="lede">{slow ? u.readingSlow : u.readingFast}</p>
        <ReviewSkeleton />
      </section>
    );
  }

  return (
    <section className="screen">
      <p className="eyebrow">{u.eyebrow}</p>
      <h1>
        {u.titleBefore}{" "}
        <span className="circled">
          {u.titleCircled}
          <PenCircle />
        </span>
        {u.titleAfter ? ` ${u.titleAfter}` : ""}?
      </h1>
      <p className="lede">{u.lede}</p>

      <div className="card">
        <label className="field">
          <span>{u.credit}</span>
          <select value={creditTier} onChange={(e) => setCreditTier(e.target.value)}>
            {CREDIT_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {t.tiers[tier]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            {u.kbb} <em>{u.optional}</em>
          </span>
          <input
            inputMode="decimal"
            placeholder={u.kbbPlaceholder}
            value={kbbValue}
            onChange={(e) => setKbbValue(e.target.value)}
          />
          <small className="hint">{u.kbbHint}</small>
        </label>
      </div>

      {(error || notice) && (
        <div className="alert" role="alert">
          {error || notice}
        </div>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={() => cameraInput.current.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {u.snap}
        </button>
        <button className="btn" onClick={() => fileInput.current.click()}>
          {u.upload}
        </button>
        <button className="link" onClick={onManual}>
          {u.manual}
        </button>
      </div>

      <div className="trust">
        {u.trust.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={handleFile} />
    </section>
  );
}

// Placeholder shaped like the Review screen, so the page doesn't jump when it loads.
function ReviewSkeleton() {
  const field = (wide) => (
    <div className={`field ${wide ? "wide" : ""}`}>
      <span className="skel skel-label" />
      <span className="skel skel-input" />
    </div>
  );
  return (
    <div aria-hidden="true">
      <div className="card">
        <div className="row">
          {field()}
          {field()}
        </div>
      </div>
      <div className="card">
        <span className="skel skel-heading" />
        <div className="grid">
          {field(true)}
          {field()}
          {field()}
        </div>
      </div>
      <div className="card">
        <span className="skel skel-heading" />
        <div className="grid">
          {field()}
          {field()}
          {field()}
          {field()}
        </div>
      </div>
    </div>
  );
}
