import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n.js";

// Fine Print Shield on the Results screen. Claude quoted the clauses; the
// explanations are vetted text from the server.

// App provides the fine print for the current upload, so Results only has to render <FinePrint />.
const FinePrintContext = createContext(null);

export function FinePrintProvider({ value, children }) {
  return <FinePrintContext.Provider value={value}>{children}</FinePrintContext.Provider>;
}

// Protections worth showing the dealer in big type.
const SHOWABLE = ["optional_products_notice", "holder_notice"];

export default function FinePrint() {
  const state = useContext(FinePrintContext);
  const t = useT().finePrint;
  const [shown, setShown] = useState(null); // quote open full screen
  const hide = useCallback(() => setShown(null), []);

  if (!state || state.status === "error") return null;

  if (state.status === "loading") {
    return (
      <section className="fine-print" aria-labelledby="fine-print-title" aria-busy="true">
        <h2 id="fine-print-title" className="section-title">
          {t.title}
        </h2>
        <div className="sheet fp-loading">
          <p className="muted small">{t.loading}</p>
          <span className="skel skel-heading" aria-hidden="true" />
          <span className="skel fp-skel-line" aria-hidden="true" />
          <span className="skel fp-skel-line short" aria-hidden="true" />
        </div>
      </section>
    );
  }

  const { clauses = [], general = [], checklist, mock } = state.data ?? {};
  return (
    <section className="fine-print" aria-labelledby="fine-print-title">
      <h2 id="fine-print-title" className="section-title">
        {t.title}
      </h2>
      {clauses.length > 0 && <p className="muted small">{t.lede}</p>}
      {mock && <p className="mock-banner fp-mock">{t.mock}</p>}
      {clauses.map((card) => (
        <Card key={card.type} card={card} t={t} onShow={SHOWABLE.includes(card.type) ? () => setShown(card.quote) : null} />
      ))}
      {checklist?.length > 0 && (
        <div className="sheet fp-card warning fp-checklist">
          <p className="fp-tone">{t.tone.warning}</p>
          <h3 className="fp-title">{t.checklist}</h3>
          <ul>
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {general.map((card) => (
        <Card key={card.type} card={card} t={t} />
      ))}
      {shown && <ShowDealer quote={shown} t={t} onClose={hide} />}
    </section>
  );
}

function Card({ card, t, onShow }) {
  const source = card.source ?? {};
  return (
    <article className={`sheet fp-card ${card.tone}`}>
      <p className="fp-tone">{t.tone[card.tone] ?? t.tone.info}</p>
      <h3 className="fp-title">{card.title}</h3>
      {card.quote && (
        <figure className="fp-quote">
          <blockquote>
            <mark>{card.quote}</mark>
          </blockquote>
          <figcaption>{t.onPaper}</figcaption>
        </figure>
      )}
      <p>{card.explain}</p>
      <p>
        <strong>{t.doThis}</strong> {card.action}
      </p>
      {source.name && (
        <p className="source">
          {t.source}:{" "}
          {source.url ? (
            <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer">
              {source.name}
            </a>
          ) : (
            source.name
          )}
        </p>
      )}
      {onShow && (
        <button className="btn fp-show" onClick={onShow}>
          {t.show}
        </button>
      )}
    </article>
  );
}

// Full-screen, very large quote to hold up at the desk.
function ShowDealer({ quote, t, onClose }) {
  const closeButton = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault(); // the close button is the only control; keep focus in the dialog
        closeButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="fp-overlay" role="dialog" aria-modal="true" aria-labelledby="fp-overlay-label">
      <p id="fp-overlay-label" className="fp-overlay-label">
        {t.showLabel}
      </p>
      <blockquote className={`fp-overlay-quote ${quote.length > 160 ? "long" : ""}`}>
        <mark>{quote}</mark>
      </blockquote>
      <button ref={closeButton} className="btn primary big" onClick={onClose}>
        {t.close}
      </button>
    </div>,
    document.body,
  );
}
