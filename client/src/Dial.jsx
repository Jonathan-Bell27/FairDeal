import { useEffect, useState } from "react";

// Half-circle gauge drawn like a pen sketch. The needle sweeps up from 0 and
// the number counts up to the score. Zones match the verdict bands.

const CX = 100;
const CY = 100;
const R = 78;
const SWEEP_MS = 1400;

// Score 0..100 -> point on the arc (0 at the left, 100 at the right).
const point = (score, r = R) => {
  const a = Math.PI * (1 - score / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (from, to) => {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Dial({ score, verdict, label, ofText }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? score : 0));

  useEffect(() => {
    if (reducedMotion()) return;
    let frame;
    const start = performance.now() + 250; // let the page settle first
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - start) / SWEEP_MS));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(score * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const [nx, ny] = point(shown, R - 14);
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <div className={`dial ${verdict}`} role="img" aria-label={label}>
      <svg viewBox="0 0 200 118" aria-hidden="true">
        <path className="dial-zone walk" d={arc(0, 59)} />
        <path className="dial-zone negotiate" d={arc(60, 84)} />
        <path className="dial-zone fair" d={arc(85, 100)} />
        {ticks.map((t) => {
          const [x1, y1] = point(t, R - 9);
          const [x2, y2] = point(t, R - (t % 50 === 0 ? 19 : 14));
          return <line key={t} className="dial-tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        <line className="dial-needle" x1={CX} y1={CY} x2={nx} y2={ny} />
        <circle className="dial-hub" cx={CX} cy={CY} r="5" />
      </svg>
      <div className="dial-number">
        {shown}
        <small>{ofText}</small>
      </div>
    </div>
  );
}
