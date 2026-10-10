import { useEffect, useState } from "react";
import { analyzeDeal, emptyDeal, wakeServer } from "./api.js";
import Upload from "./screens/Upload.jsx";
import Review from "./screens/Review.jsx";
import Results from "./screens/Results.jsx";
import Counteroffer from "./screens/Counteroffer.jsx";

// Screens in order: upload -> review -> results -> counteroffer.
export default function App() {
  const [screen, setScreen] = useState("upload");
  const [creditTier, setCreditTier] = useState("Good");
  const [kbbValue, setKbbValue] = useState("");
  const [deal, setDeal] = useState(emptyDeal());
  const [extractNote, setExtractNote] = useState("");
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(wakeServer, []);
  useEffect(() => window.scrollTo(0, 0), [screen]);

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
      setResult(await analyzeDeal(deal, creditTier, kbbValue));
      setScreen("results");
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const startOver = () => {
    setDeal(emptyDeal());
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
