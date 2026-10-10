import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n.js";
import { drawCard, encodeShare, qrMatrix, shareLink } from "../share.js";
import QR from "../QR.jsx";

// Second opinion: a picture of the verdict plus a link (and QR code) that
// opens this exact markup on someone else's phone.
export default function Share({ result, deal, creditTier, kbbValue, onBack }) {
  const all = useT();
  const t = all.share;
  const link = useMemo(() => shareLink(encodeShare({ deal, creditTier, kbbValue })), [deal, creditTier, kbbValue]);
  // The card is drawn for one link + language; a stale card counts as not drawn yet.
  const [drawn, setDrawn] = useState(null); // { key, blob, url } or { key, failed: true }
  const [copied, setCopied] = useState(false);
  const drawKey = `${link}|${all.share.card.eyebrow}|${result.score}`;
  const card = drawn?.key === drawKey ? (drawn.failed ? false : drawn) : null;

  useEffect(() => {
    let cancelled = false;
    let url;
    drawCard({ result, deal, link, t: all })
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return setDrawn({ key: drawKey, failed: true });
        url = URL.createObjectURL(blob);
        setDrawn({ key: drawKey, blob, url });
      })
      .catch(() => !cancelled && setDrawn({ key: drawKey, failed: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [drawKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = `${t.message} ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.copy, link);
    }
  };

  // Phones get the native share sheet with the picture attached. Browsers that
  // can't share files send just the message; anything else copies the link.
  const send = async () => {
    const file = card && new File([card.blob], "fairdeal-deal.png", { type: "image/png" });
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.shareTitle, text: message });
      } else if (navigator.share) {
        await navigator.share({ title: t.shareTitle, text: t.message, url: link });
      } else {
        await copy();
      }
    } catch (err) {
      if (err?.name !== "AbortError") await copy();
    }
  };

  return (
    <section className="screen share">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="lede">{t.lede}</p>

      <div className="share-card-frame">
        {card ? (
          <img className="share-card" src={card.url} alt={t.cardAlt} />
        ) : card === null ? (
          <div className="share-card skel" aria-busy="true">
            <span className="sr-only">{t.preparing}</span>
          </div>
        ) : null}
      </div>

      <div className="actions">
        <button className="btn red big" onClick={send} disabled={!link}>
          {t.send}
        </button>
        <button className="btn" onClick={copy} disabled={!link}>
          {copied ? t.copied : t.copy}
        </button>
        {card && (
          <a className="btn" href={card.url} download="fairdeal-deal.png">
            {t.save}
          </a>
        )}
      </div>

      {link && qrMatrix(link) && (
        <div className="sheet scan">
          <QR text={link} label={t.scanTitle} />
          <div>
            <h2>{t.scanTitle}</h2>
            <p className="muted small">{t.scanHint}</p>
          </div>
        </div>
      )}

      <p className="hint">{t.privacy}</p>

      <div className="actions">
        <button className="link" onClick={onBack}>
          {t.back}
        </button>
      </div>
    </section>
  );
}
