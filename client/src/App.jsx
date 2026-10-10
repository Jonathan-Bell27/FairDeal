import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeDeal, emptyDeal, wakeServer } from "./api.js";
import { clearSession, loadSession, saveSession } from "./session.js";
import Upload from "./screens/Upload.jsx";
import Review from "./screens/Review.jsx";
import Results from "./screens/Results.jsx";
import Counteroffer from "./screens/Counteroffer.jsx";

const saved = loadSession();
// A results screen can't be restored without its result.
if (saved && !saved.result && (saved.screen === "results" || saved.screen === "counter")) saved.screen = "review";

const hasPrice = (deal) => Number(String(deal.vehicle_price).replace(/[$,]/g, "")) > 0;

// Screens in order: upload -> review -> results -> counteroffer.
export default function App() {
  const [screen, setScreen] = useState(saved?.screen ?? "upload");
  const [creditTier, setCreditTier] = useState(saved?.creditTier ?? "Good");
  const [kbbValue, setKbbValue] = useState(saved?.kbbValue ?? "");
  const [deal, setDeal] = useState(saved?.deal ?? emptyDeal());
  const [extractNote, setExtractNote] = useState(saved?.extractNote ?? "");
  const [result, setResult] = useState(saved?.result ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(wakeServer, []);
  useEffect(() => window.scrollTo(0, 0), [screen]);
  useEffect(() => {
    saveSession({ screen, creditTier, kbbValue, deal, extractNote, result });
  }, [screen, creditTier, kbbValue, deal, extractNote, result]);

  // Analysis results keyed by their exact inputs. The Review screen fills this
  // in the background, so "Check this deal" is usually instant.
  const analyses = useRef(new Map());
  const getAnalysis = useCallback((d, tier, kbb) => {
    const key = JSON.stringify([d, tier, kbb]);
    if (!analyses.current.has(key)) {
      if (analyses.current.size > 20) analyses.current.clear();
      const pending = analyzeDeal(d, tier, kbb);
      pending.catch(() => analyses.current.delete(key)); // retry on the next ask
      analyses.current.set(key, pending);
    }
    return analyses.current.get(key);
  }, []);

  useEffect(() => {
    if (screen !== "review" || !hasPrice(deal)) return;
    const t = setTimeout(() => getAnalysis(deal, creditTier, kbbValue).catch(() => {}), 500);
    return () => clearTimeout(t);
  }, [screen, deal, creditTier, kbbValue, getAnalysis]);

  const goReview = (newDeal, note = "") => {
    setDeal(newDeal);
    setExtractNote(note);
    setError("");
    setScreen("review");
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      setResult(await getAnalysis(deal, creditTier, kbbValue));
      setScreen("results");
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const startOver = () => {
    clearSession();
    setDeal(emptyDeal());
    setExtractNote("");
    setResult(null);
    setError("");
    setScreen("upload");
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={startOver}>
          Fair<span>Deal</span>
        </button>
        {screen !== "upload" && (
          <button className="link" onClick={startOver}>
            Start over
          </button>
        )}
      </header>

      <main>
        {screen === "upload" && (
          <Upload
            creditTier={creditTier}
            setCreditTier={setCreditTier}
            kbbValue={kbbValue}
            setKbbValue={setKbbValue}
            onExtracted={(d, ms) => goReview(d, `Read in ${(ms / 1000).toFixed(1)}s. Check every number against your paperwork.`)}
            onManual={() => goReview(emptyDeal())}
          />
        )}
        {screen === "review" && (
          <Review
            deal={deal}
            setDeal={setDeal}
            creditTier={creditTier}
            setCreditTier={setCreditTier}
            kbbValue={kbbValue}
            setKbbValue={setKbbValue}
            note={extractNote}
            onAnalyze={runAnalysis}
            analyzing={analyzing}
            error={error}
          />
        )}
        {screen === "results" && result && (
          <Results result={result} onEdit={() => setScreen("review")} onCounter={() => setScreen("counter")} />
        )}
        {screen === "counter" && result && (
          <Counteroffer text={result.counteroffer} onBack={() => setScreen("results")} />
        )}
      </main>
    </div>
  );
}
