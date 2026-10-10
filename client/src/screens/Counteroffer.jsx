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
      <h1>Your counteroffer</h1>
      <p className="lede">Edit it if you like, then copy it or text it to the dealer.</p>

      <textarea className="counter-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} />

      <div className="actions">
        <a className="btn primary big" href={smsHref}>
          Text it to the dealer
        </a>
        <button className="btn" onClick={copy}>
          {copied ? "Copied!" : "Copy message"}
        </button>
        <button className="link" onClick={onBack}>
          Back to results
        </button>
      </div>
    </section>
  );
}
