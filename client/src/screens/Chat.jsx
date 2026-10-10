import { useEffect, useRef, useState } from "react";
import { streamChat } from "../api.js";
import { useT } from "../i18n.js";

// Follow-up conversation about the deal.
// mode "ask": the buyer asks questions; Claude answers (and can search the web).
// mode "practice": Claude plays the finance manager; the buyer practices saying no,
// then asks for feedback.
export default function Chat({ mode, ctx, messages, setMessages, feedback, setFeedback, onBack }) {
  const t = useT().chat;
  const m = mode === "practice" ? t.practice : t.ask;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [grading, setGrading] = useState(false);
  const controller = useRef(null);
  const endRef = useRef(null);
  const started = useRef(false);

  // Leaving mid-reply: stop the stream and drop the empty placeholder.
  const dropEmpty = (list) => (list.at(-1)?.role === "assistant" && !list.at(-1).content ? list.slice(0, -1) : list);
  useEffect(
    () => () => {
      controller.current?.abort();
      setMessages(dropEmpty);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, feedback, busy]);

  // Send the conversation so far and stream Claude's reply into a new message.
  const run = (history) => {
    controller.current?.abort();
    const ctl = new AbortController();
    controller.current = ctl;
    setBusy(true);
    setError("");
    setMessages([...history, { role: "assistant", content: "", searches: [] }]);
    const update = (fn) =>
      setMessages((list) => {
        const copy = [...list];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });
    streamChat(
      { ...ctx, mode, messages: history.map(({ role, content }) => ({ role, content })) },
      (event, data) => {
        if (ctl.signal.aborted) return;
        if (event === "delta") update((msg) => ({ ...msg, content: msg.content + data.text }));
        if (event === "search") update((msg) => ({ ...msg, searches: [...(msg.searches ?? []), data.query] }));
        if (event === "error") setError(data.error);
      },
      ctl.signal,
    )
      .catch((err) => {
        if (!ctl.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (ctl.signal.aborted) return;
        setBusy(false);
        // Drop an empty reply left by an error so the conversation stays clean.
        setMessages(dropEmpty);
      });
  };

  // Practice opens with the finance manager's first line.
  useEffect(() => {
    if (mode !== "practice" || messages.some((msg) => msg.content) || started.current) return;
    started.current = true;
    run([]);
    return () => {
      started.current = false; // StrictMode re-mounts: let the second mount start it again
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (text) => {
    const content = text.trim();
    if (!content || busy) return;
    setDraft("");
    setFeedback?.(null);
    run([...messages, { role: "user", content }]);
  };

  const getFeedback = () => {
    setGrading(true);
    setError("");
    streamChat(
      { ...ctx, mode: "feedback", messages: messages.map(({ role, content }) => ({ role, content })) },
      (event, data) => {
        if (event === "feedback") setFeedback(data);
        if (event === "error") setError(data.error);
      },
    )
      .catch((err) => setError(err.message))
      .finally(() => setGrading(false));
  };

  const restart = () => {
    controller.current?.abort();
    setFeedback?.(null);
    setMessages([]);
    run([]);
  };

  const userTurns = messages.filter((msg) => msg.role === "user").length;

  return (
    <section className={`screen chat ${mode}`}>
      <p className="eyebrow">{m.eyebrow}</p>
      <h1>{m.title}</h1>
      <p className="lede">{m.lede}</p>

      <div className="thread" aria-live="polite">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>
            {msg.role === "assistant" && <span className="who">{m.who}</span>}
            {msg.searches?.map((q) => (
              <span key={q} className="searched">
                {t.searched(q)}
              </span>
            ))}
            <p>
              {msg.content}
              {busy && i === messages.length - 1 && msg.role === "assistant" && <span className="caret" aria-hidden="true" />}
            </p>
          </div>
        ))}
      </div>

      {mode === "ask" && messages.length === 0 && (
        <div className="chips" role="group" aria-label={t.suggested}>
          {t.ask.suggestions.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          {error}
          {messages.length > 0 && (
            <div className="alert-actions">
              <button
                className="btn"
                onClick={() => run(messages.at(-1)?.role === "user" ? messages : messages.slice(0, -1))}
              >
                {t.retry}
              </button>
            </div>
          )}
        </div>
      )}

      {feedback && <Feedback feedback={feedback} t={t.practice} />}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          rows={1}
          value={draft}
          placeholder={m.placeholder}
          aria-label={m.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          maxLength={1000}
        />
        <button className="btn primary send" type="submit" disabled={busy || !draft.trim()}>
          {t.send}
        </button>
      </form>

      <div className="actions">
        {mode === "practice" && (
          <>
            <button className="btn red" onClick={getFeedback} disabled={busy || grading || userTurns < 2}>
              {grading ? t.practice.grading : userTurns < 2 ? t.practice.needTurns : t.practice.grade}
            </button>
            <button className="btn" onClick={restart} disabled={busy}>
              {t.practice.again}
            </button>
          </>
        )}
        <button className="link" onClick={onBack}>
          {t.back}
        </button>
      </div>
      <p className="disclaimer">{t.disclaimer}</p>
      <div ref={endRef} />
    </section>
  );
}

function Feedback({ feedback, t }) {
  const tone = feedback.score >= 8 ? "fair" : feedback.score >= 5 ? "negotiate" : "walk";
  const lists = [
    ["went_well", t.wentWell],
    ["improve", t.improve],
    ["try_saying", t.trySaying],
  ];
  return (
    <div className={`sheet feedback ${tone}`}>
      {feedback.mock && <p className="mock-banner">{t.mock}</p>}
      <p className="feedback-score">
        {feedback.score}
        <small>/10</small>
      </p>
      <p>{feedback.summary}</p>
      {lists.map(([key, label]) =>
        feedback[key]?.length ? (
          <div key={key}>
            <h3>{label}</h3>
            <ul>
              {feedback[key].map((line, i) => (
                <li key={i}>{key === "try_saying" ? `“${line}”` : line}</li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
