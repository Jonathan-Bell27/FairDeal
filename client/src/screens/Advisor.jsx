import { useEffect, useRef, useState } from "react";
import { streamAdvice } from "../api.js";
import { useT } from "../i18n.js";

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// Runs Claude's research for this deal, showing each search as it happens,
// then the personal plan and findings with source links.
export default function Advisor({ deal, creditTier, kbbValue, lang, profile, report, setReport, onBack, onChat, onPractice }) {
  const t = useT().advisor;
  const [searches, setSearches] = useState([]);
  const [sourceCount, setSourceCount] = useState(0);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(!report);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (report || started.current) return;
    started.current = true;
    const controller = new AbortController();
    streamAdvice(
      { deal, creditTier, kbbValue, lang, profile },
      (event, data) => {
        if (controller.signal.aborted) return;
        if (event === "search") setSearches((s) => [...s, data.query]);
        if (event === "source") setSourceCount((n) => n + 1);
        if (event === "report") setReport(data);
        if (event === "error") setError(data.error);
        if (event === "done") setRunning(false);
      },
      controller.signal,
    )
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRunning(false);
      });
    return () => {
      controller.abort();
      started.current = false;
    };
    // Re-run only on an explicit retry.
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    setSearches([]);
    setSourceCount(0);
    setError("");
    setRunning(true);
    setAttempt((a) => a + 1);
  };

  return (
    <section className="screen advisor">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{report ? t.titleDone : t.title}</h1>

      {!report && (
        <div className="sheet research-log" aria-live="polite">
          <p className="log-head">{running ? t.working : error ? t.stopped : t.finishing}</p>
          <ol>
            {searches.map((q, i) => (
              <li key={i} className={running && i === searches.length - 1 ? "active" : "done"}>
                <span className="log-mark" aria-hidden="true" />
                {t.searching(q)}
              </li>
            ))}
            {running && searches.length === 0 && (
              <li className="active">
                <span className="log-mark" aria-hidden="true" />
                {t.starting}
              </li>
            )}
          </ol>
          {sourceCount > 0 && <p className="log-foot">{t.sourcesRead(sourceCount)}</p>}
          {running && <p className="hint">{t.takes}</p>}
        </div>
      )}

      {error && !report && (
        <div className="alert" role="alert">
          <strong>{t.failed}</strong> {error}
          <div className="alert-actions">
            <button className="btn" onClick={retry}>
              {t.retry}
            </button>
          </div>
        </div>
      )}

      {report && <Report report={report} t={t} />}

      <div className="actions">
        {report && onChat && (
          <button className="btn primary big" onClick={onChat}>
            {t.ask}
          </button>
        )}
        {report && onPractice && (
          <button className="btn" onClick={onPractice}>
            {t.practice}
          </button>
        )}
        <button className="link" onClick={onBack}>
          {t.back}
        </button>
      </div>
    </section>
  );
}

function Report({ report, t }) {
  const a = report.affordability;
  const sections = [
    ["recalls", t.recalls, (r) => [r.title, r.detail]],
    ["known_issues", t.issues, (r) => [r.title, r.detail]],
    ["rates", t.rates, (r) => [`${r.lender}: ${r.apr}`, r.detail]],
    ["comparables", t.comparables, (r) => [`${r.title}: ${r.price}`, r.detail]],
  ];
  return (
    <>
      {report.mock && <p className="mock-banner">{t.mock}</p>}
      <p className="lede">{report.summary}</p>

      <div className={`sheet afford ${a.verdict}`}>
        <p className="afford-label">{t.afford}</p>
        <p className="afford-verdict">{t.verdicts[a.verdict] ?? a.verdict}</p>
        <p>{a.explanation}</p>
      </div>

      <h2 className="section-title">{t.plan}</h2>
      <ol className="plan">
        {report.plan.map((p, i) => (
          <li key={i}>
            <strong>{p.step}</strong>
            <span>{p.why}</span>
          </li>
        ))}
      </ol>

      {report.say_this.length > 0 && (
        <>
          <h2 className="section-title">{t.say}</h2>
          <div className="scripts">
            {report.say_this.map((line, i) => (
              <blockquote key={i}>“{line}”</blockquote>
            ))}
          </div>
        </>
      )}

      {report.walk_away_if.length > 0 && (
        <>
          <h2 className="section-title">{t.walk}</h2>
          <ul className="walk-list">
            {report.walk_away_if.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title">{t.research}</h2>
      <div className="sheet findings">
        {sections.map(([key, title, row]) => (
          <div className="finding-group" key={key}>
            <h3>{title}</h3>
            {report[key].length === 0 ? (
              <p className="muted small">{t.none}</p>
            ) : (
              report[key].map((r, i) => {
                const [head, detail] = row(r);
                return (
                  <div className="finding" key={i}>
                    <p className="finding-head">{head}</p>
                    <p>{detail}</p>
                    {r.source_url && (
                      <a className="source-link" href={r.source_url} target="_blank" rel="noreferrer">
                        {host(r.source_url)} ↗
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      {report.sources?.length > 0 && (
        <details className="all-sources">
          <summary>{t.allSources(report.sources.length)}</summary>
          <ul>
            {report.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title || host(s.url)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="disclaimer">{t.disclaimer}</p>
    </>
  );
}
