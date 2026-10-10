import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A number that rolls to its value: from `from` when it first appears, then
// from its previous value whenever it changes.
export function useCountUp(value, ms = 900, from = value) {
  const [shown, setShown] = useState(from);
  const at = useRef(from);

  useEffect(() => {
    if (reducedMotion()) return;
    const start = at.current;
    if (start === value) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms)); // frame time can be a hair before t0
      at.current = start + (value - start) * (1 - Math.pow(1 - p, 3));
      setShown(at.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return reducedMotion() ? value : shown;
}
