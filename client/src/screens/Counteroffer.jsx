import { useState } from "react";

export default function Counteroffer({ text: initialText, onBack }) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: select the text so the user can copy it.
      document.querySelector(".counter-text")?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // "sms:?&body=" opens the text app pre-filled on both iPhone and Android.
  const smsHref = `sms:?&body=${encodeURIComponent(text)}`;

  return (
    <section className="screen">
      <p className="eyebrow">Step 3 of 3</p>
      <h1>Your counteroffer</h1>
      <p className="lede">Edit anything you like, then text it to the dealer or copy it.</p>

      <div className="sheet letter">
        <textarea
          className="counter-text"
          aria-label="Counteroffer message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
        />
      </div>

      <div className="actions">
        <a className="btn red big" href={smsHref}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Text it to the dealer
        </a>
        <button className="btn" onClick={copy}>
          {copied ? "Copied ✓" : "Copy message"}
        </button>
        <button className="link" onClick={onBack}>
          Back to the markup
        </button>
      </div>
    </section>
  );
}
