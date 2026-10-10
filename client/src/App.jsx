import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeDeal, emptyDeal, wakeServer } from "./api.js";
import { clearSession, loadSession, saveSession } from "./session.js";
import { LangContext, STRINGS } from "./i18n.js";
import { initialLang, initialTheme, setPref } from "./prefs.js";
import Upload from "./screens/Upload.jsx";
import Review from "./screens/Review.jsx";
import Results from "./screens/Results.jsx";
import Counteroffer from "./screens/Counteroffer.jsx";
import Advisor from "./screens/Advisor.jsx";
import Chat from "./screens/Chat.jsx";
import Share from "./screens/Share.jsx";
import { PenSquiggle } from "./Pen.jsx";
import { clearSharedCode, decodeShare, sharedCodeInUrl } from "./share.js";

// Opened from someone's second-opinion link? That deal replaces any saved session.
const sharedCode = sharedCodeInUrl();
const sharedDeal = sharedCode ? decodeShare(sharedCode) : null;
const saved = sharedCode ? null : loadSession();
// A results screen can't be restored without its result.
if (saved && !saved.result && ["results", "counter", "advisor", "chat", "practice", "share"].includes(saved.screen)) saved.screen = "review";

const hasPrice = (deal) => Number(String(deal.vehicle_price).replace(/[$,]/g, "")) > 0;
const keyOf = (...inputs) => JSON.stringify(inputs);

// Screens in order: upload -> review -> results -> counteroffer.
export default function App() {
  const [screen, setScreen] = useState(sharedDeal ? "opening" : sharedCode ? "upload" : saved?.screen ?? "upload");
  const [creditTier, setCreditTier] = useState(sharedDeal?.creditTier ?? saved?.creditTier ?? "Good");
  const [kbbValue, setKbbValue] = useState(sharedDeal?.kbbValue ?? saved?.kbbValue ?? "");
  const [deal, setDeal] = useState(sharedDeal?.deal ?? saved?.deal ?? emptyDeal());
  const [extractMs, setExtractMs] = useState(saved?.extractMs ?? null);
  const [result, setResult] = useState(saved?.result ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(sharedCode && !sharedDeal ? STRINGS[initialLang()].share.openFailed : "");
  const [profile, setProfile] = useState(saved?.profile ?? { zip: "", monthly_income: "", keep_years: "", notes: "" });
  // Claude's research, tagged with the inputs it was run on so edits trigger a fresh run.
  const [advice, setAdvice] = useState(saved?.advice ?? null);
  // Chat and practice conversations, also tagged with the deal they're about.
  const [chats, setChats] = useState(saved?.chats ?? null);
  // True when this deal came from someone else's share link.
  const [shared, setShared] = useState(Boolean(sharedDeal) || (saved?.shared ?? false));
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const t = STRINGS[lang];

  useEffect(wakeServer, []);
  // A share link pasted into a tab that already has FairDeal open only changes
  // the #fragment, so reload to open it.
  useEffect(() => {
    const onHash = () => sharedCodeInUrl() && location.reload();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => window.scrollTo(0, 0), [screen]);
  useEffect(() => {
    if (screen === "opening") return;
    saveSession({ screen, creditTier, kbbValue, deal, extractMs, result, profile, advice, chats, shared });
  }, [screen, creditTier, kbbValue, deal, extractMs, result, profile, advice, chats, shared]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const adviceKey = keyOf(deal, creditTier, kbbValue, lang, profile);
  const report = advice?.key === adviceKey ? advice.report : null;
  // Conversations reset when the deal changes, not when the language does.
  const chatKey = keyOf(deal, creditTier, kbbValue);
  const chat = chats?.key === chatKey ? chats : { key: chatKey, ask: [], practice: [], feedback: null };
  const setChat = (patch) =>
    setChats((prev) => {
      const base = prev?.key === chatKey ? prev : { key: chatKey, ask: [], practice: [], feedback: null };
      const next = typeof patch === "function" ? patch(base) : patch;
      return { ...base, ...next };
    });
  const chatBack = useRef("results");
  const openChat = (mode) => {
    chatBack.current = screen;
    setScreen(mode);
  };

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

  // True only while a shared link is opening; leaving that screen abandons it.
  const opening = useRef(Boolean(sharedDeal));

  const startOver = () => {
    opening.current = false;
    // Someone else's credit range and KBB value don't belong on your own deal.
    if (shared) {
      setCreditTier("Good");
      setKbbValue("");
    }
    clearSession();
    setDeal(emptyDeal());
    setExtractMs(null);
    setResult(null);
    setAdvice(null);
    setChats(null);
    setShared(false);
    setError("");
    setScreen("upload");
  };

  // Open a shared deal: decode the link, run the same analysis, show the markup.
  // The link stays in the address bar until the markup is ready, so a reload
  // while the server wakes up opens it again.
  useEffect(() => {
    if (!sharedCode) return;
    if (!sharedDeal) return clearSharedCode();
    let cancelled = false;
    const done = () => cancelled || !opening.current;
    getAnalysis(sharedDeal.deal, sharedDeal.creditTier, sharedDeal.kbbValue, lang)
      .then((r) => {
        clearSharedCode();
        if (done()) return;
        opening.current = false;
        setResult(r);
        setScreen("results");
      })
      .catch((err) => {
        clearSharedCode();
        if (done()) return;
        opening.current = false;
        setError(err.message);
        setScreen("review");
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              notice={error}
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
            <Results
              result={result}
              onEdit={() => setScreen("review")}
              onCounter={() => setScreen("counter")}
              onShare={() => setScreen("share")}
              shared={shared}
              onStartOver={startOver}
              profile={profile}
              setProfile={setProfile}
              hasReport={advice?.key === adviceKey}
              onAdvise={() => setScreen("advisor")}
              onChat={() => openChat("chat")}
              onPractice={() => openChat("practice")}
            />
          )}
          {screen === "advisor" && result && (
            <Advisor
              key={adviceKey}
              deal={deal}
              creditTier={creditTier}
              kbbValue={kbbValue}
              lang={lang}
              profile={profile}
              report={report}
              setReport={(r) => setAdvice({ key: adviceKey, report: r })}
              onBack={() => setScreen("results")}
              onChat={() => openChat("chat")}
              onPractice={() => openChat("practice")}
            />
          )}
          {(screen === "chat" || screen === "practice") && result && (
            <Chat
              key={`${screen}:${chatKey}`}
              mode={screen === "chat" ? "ask" : "practice"}
              ctx={{ deal, creditTier, kbbValue, lang, report }}
              messages={screen === "chat" ? chat.ask : chat.practice}
              setMessages={(m) => {
                const field = screen === "chat" ? "ask" : "practice";
                setChat((c) => ({ [field]: typeof m === "function" ? m(c[field]) : m }));
              }}
              feedback={chat.feedback}
              setFeedback={(f) => setChat({ feedback: f })}
              onBack={() => setScreen(chatBack.current === screen ? "results" : chatBack.current)}
            />
          )}
          {screen === "opening" && (
            <section className="screen" aria-busy="true" aria-live="polite">
              <p className="eyebrow">{t.share.eyebrow}</p>
              <h1>{t.share.opening}</h1>
              <p className="lede">{t.upload.readingSlow}</p>
            </section>
          )}
          {screen === "share" && result && (
            <Share
              result={result}
              deal={deal}
              creditTier={creditTier}
              kbbValue={kbbValue}
              onBack={() => setScreen("results")}
            />
          )}
          {screen === "counter" && result && (
            <Counteroffer key={result.counteroffer} text={result.counteroffer} onBack={() => setScreen("results")} />
          )}
        </main>
      </div>
    </LangContext.Provider>
  );
}
