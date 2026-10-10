import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeDeal, emptyDeal, wakeServer } from "./api.js";
import { clearSession, loadSession, saveSession } from "./session.js";
import { LangContext, STRINGS } from "./i18n.js";
import { initialLang, initialTheme, setPref } from "./prefs.js";
import Upload from "./screens/Upload.jsx";
import Review from "./screens/Review.jsx";
import Results from "./screens/Results.jsx";
import Counteroffer from "./screens/Counteroffer.jsx";
import { PenSquiggle } from "./Pen.jsx";

const saved = loadSession();
// A results screen can't be restored without its result.
if (saved && !saved.result && (saved.screen === "results" || saved.screen === "counter")) saved.screen = "review";

const hasPrice = (deal) => Number(String(deal.vehicle_price).replace(/[$,]/g, "")) > 0;
const keyOf = (...inputs) => JSON.stringify(inputs);

// Screens in order: upload -> review -> results -> counteroffer.
export default function App() {
  const [screen, setScreen] = useState(saved?.screen ?? "upload");
  const [creditTier, setCreditTier] = useState(saved?.creditTier ?? "Good");
  const [kbbValue, setKbbValue] = useState(saved?.kbbValue ?? "");
  const [deal, setDeal] = useState(saved?.deal ?? emptyDeal());
  const [extractMs, setExtractMs] = useState(saved?.extractMs ?? null);
  const [result, setResult] = useState(saved?.result ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const t = STRINGS[lang];

  useEffect(wakeServer, []);
  useEffect(() => window.scrollTo(0, 0), [screen]);
  useEffect(() => {
    saveSession({ screen, creditTier, kbbValue, deal, extractMs, result });
  }, [screen, creditTier, kbbValue, deal, extractMs, result]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleLang = () => {
    const next = lang === "en" ? "es" : "en";
    setLang(next);
    setPref("lang", next);
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setPref("theme", next);
  };

  // Analysis results keyed by their exact inputs. The Review screen fills this
  // in the background, so "Check this deal" is usually instant.
  const analyses = useRef(new Map());
  const getAnalysis = useCallback((d, tier, kbb, lng) => {
    const key = keyOf(d, tier, kbb, lng);
    if (!analyses.current.has(key)) {
      if (analyses.current.size > 20) analyses.current.clear();
      const pending = analyzeDeal(d, tier, kbb, lng);
      pending.catch(() => analyses.current.delete(key)); // retry on the next ask
      analyses.current.set(key, pending);
    }
    return analyses.current.get(key);
  }, []);

  useEffect(() => {
    if (screen !== "review" || !hasPrice(deal)) return;
    const timer = setTimeout(() => getAnalysis(deal, creditTier, kbbValue, lang).catch(() => {}), 500);
    return () => clearTimeout(timer);
  }, [screen, deal, creditTier, kbbValue, lang, getAnalysis]);

  // Switching language on the results or counteroffer screen re-runs the
  // analysis so the flags and counteroffer come back in the new language.
  useEffect(() => {
    if (!result || result.inputs?.lang === lang) return;
    let cancelled = false;
    getAnalysis(deal, creditTier, kbbValue, lang)
      .then((r) => !cancelled && setResult(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang, result, deal, creditTier, kbbValue, getAnalysis]);

  const goReview = (newDeal, ms = null) => {
    setDeal(newDeal);
    setExtractMs(ms);
    setError("");
    setScreen("review");
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      setResult(await getAnalysis(deal, creditTier, kbbValue, lang));
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
    setExtractMs(null);
    setResult(null);
    setError("");
    setScreen("upload");
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={startOver} aria-label="FairDeal">
            FairDeal
            <PenSquiggle />
          </button>
          <div className="topbar-tools">
            {screen !== "upload" && (
              <button className="link" onClick={startOver}>
                {t.startOver}
              </button>
            )}
            <button
              className="tool"
              onClick={toggleLang}
              aria-label={t.switchLangLabel}
              data-tooltip={t.switchLangLabel}
              lang={lang === "en" ? "es" : "en"}
            >
              {t.switchLang}
            </button>
            <button
              className="tool icon-tool"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t.themeToLight : t.themeToDark}
              data-tooltip={theme === "dark" ? t.themeToLight : t.themeToDark}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.5" />
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main>
          {screen === "upload" && (
            <Upload
              creditTier={creditTier}
              setCreditTier={setCreditTier}
              kbbValue={kbbValue}
              setKbbValue={setKbbValue}
              onExtracted={(d, ms) => goReview(d, ms)}
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
              note={extractMs != null ? t.upload.readIn((extractMs / 1000).toFixed(1)) : ""}
              onAnalyze={runAnalysis}
              analyzing={analyzing}
              error={error}
            />
          )}
          {screen === "results" && result && (
            <Results result={result} onEdit={() => setScreen("review")} onCounter={() => setScreen("counter")} />
          )}
          {screen === "counter" && result && (
            <Counteroffer key={result.counteroffer} text={result.counteroffer} onBack={() => setScreen("results")} />
          )}
        </main>
      </div>
    </LangContext.Provider>
  );
}
