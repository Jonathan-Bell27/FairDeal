import { useEffect, useRef, useState } from "react";
import { CREDIT_TIERS, extractDeal } from "../api.js";
import { prepareUpload } from "../image.js";
import { PenCircle } from "../Pen.jsx";

export default function Upload({ creditTier, setCreditTier, kbbValue, setKbbValue, onExtracted, onManual }) {
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
      const { deal, ms } = await extractDeal(await prepareUpload(file));
      onExtracted(deal, ms);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <section className="screen" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Step 1 of 3</p>
        <h1>Reading your contract…</h1>
        <p className="lede">
          {slow ? "Still working. The server may be waking up, which can take up to a minute." : "This usually takes a few seconds."}
        </p>
        <ReviewSkeleton />
      </section>
    );
  }

  return (
    <section className="screen">
      <p className="eyebrow">Car deal checker</p>
      <h1>
        Is this car deal{" "}
        <span className="circled">
          fair
          <PenCircle />
        </span>
        ?
      </h1>
      <p className="lede">
        Snap your buyer's order or loan offer. We'll mark up the junk fees, padded add-ons and inflated rate, then write
        your counteroffer.
      </p>

      <div className="card">
        <label className="field">
          <span>Your credit</span>
          <select value={creditTier} onChange={(e) => setCreditTier(e.target.value)}>
            {CREDIT_TIERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Kelley Blue Book value <em>(optional)</em>
          </span>
          <input
            inputMode="decimal"
            placeholder="e.g. 19,800"
            value={kbbValue}
            onChange={(e) => setKbbValue(e.target.value)}
          />
          <small className="hint">Look up the car on kbb.com so we can check the price.</small>
        </label>
      </div>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={() => cameraInput.current.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Snap your contract
        </button>
        <button className="btn" onClick={() => fileInput.current.click()}>
          Upload a photo or PDF
        </button>
        <button className="link" onClick={onManual}>
          Enter the terms manually instead
        </button>
      </div>

      <div className="trust">
        <span>Rates from Experian</span>
        <span>Prices from Consumer Reports</span>
        <span>We don't store your photo</span>
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
