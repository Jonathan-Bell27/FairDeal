import { useEffect, useRef, useState } from "react";

// Speedometer-style score gauge. The needle springs up from 0 (overshooting a
// little before settling), the number counts up and changes color as it
// crosses each zone, and the zone it lands in pops when the needle stops.

const CX = 120;
const CY = 120;
const R = 96;
const SWEEP_MS = 1700;
const ZONES = [
  { key: "walk", from: 0, to: 59 },
  { key: "negotiate", from: 60, to: 84 },
  { key: "fair", from: 85, to: 100 },
];

const zoneOf = (score) => (score >= 85 ? "fair" : score >= 60 ? "negotiate" : "walk");

// Score 0..100 -> point on the arc (0 at the left, 100 at the right).
const point = (score, r = R) => {
  const a = Math.PI * (1 - Math.min(104, Math.max(-4, score)) / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (from, to) => {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => {
  const c1 = 1.6;
  return 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
// Low scores still get a visible swing on first load: the needle lifts, then drops back.
const needleAt = (from, to, p) =>
  from + (to - from) * easeOutBack(p) + (from === 0 && to < 15 ? 14 * Math.sin(Math.PI * p) * (1 - p) : 0);

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// On first render the needle swings up from 0; when the score changes later
// (Fix-It Mode), it swings from where it is to the new score.
export default function Dial({ score, label, ofText }) {
  const [frame, setFrame] = useState({ needle: 0, shown: 0, landed: false });
  const at = useRef({ needle: 0, shown: 0 });

  useEffect(() => {
    if (reducedMotion()) return;
    let raf;
    const from = at.current;
    const start = performance.now() + (from.shown === 0 ? 300 : 0); // let the page settle first
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - start) / SWEEP_MS));
      const next = {
        needle: needleAt(from.needle, score, p),
        shown: Math.round(from.shown + (score - from.shown) * easeOutCubic(p)),
      };
      at.current = next;
      setFrame({ ...next, landed: p >= 1 });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // With reduced motion the dial just shows the score.
  const view = reducedMotion() ? { needle: score, shown: score, landed: true } : frame;
  const final = zoneOf(score);
  const live = zoneOf(view.shown);
  const [nx, ny] = point(view.needle, R - 26);
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div className={`dial ${view.landed ? "landed" : ""}`} data-zone={final} role="img" aria-label={label}>
      <svg viewBox="0 0 240 140" aria-hidden="true">
        {ZONES.map((z) => (
          <path key={z.key} className={`dial-zone ${z.key} ${z.key === final ? "active" : ""}`} d={arc(z.from + 0.8, z.to - 0.8)} />
        ))}
        {ticks.map((t) => {
          const major = t % 25 === 0;
          const [x1, y1] = point(t, R - 17);
          const [x2, y2] = point(t, R - (major ? 30 : 23));
          return <line key={t} className={`dial-tick ${major ? "major" : ""}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        <text className="dial-end" x={point(0)[0]} y={CY + 16} textAnchor="middle">0</text>
        <text className="dial-end" x={point(100)[0]} y={CY + 16} textAnchor="middle">100</text>
        <circle className={`dial-burst ${final}`} cx={CX} cy={CY} r="14" />
        <line className="dial-needle" x1={CX} y1={CY} x2={nx} y2={ny} />
        <circle className="dial-hub" cx={CX} cy={CY} r="9" />
        <circle className="dial-hub-dot" cx={CX} cy={CY} r="3.5" />
      </svg>
      <div className={`dial-number ${live}`}>
        {view.shown}
        <small>{ofText}</small>
      </div>
    </div>
  );
}
