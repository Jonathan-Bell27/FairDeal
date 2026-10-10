import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A number that rolls from its previous value to the new one when it changes.
export function useCountUp(value, ms = 900) {
  const [shown, setShown] = useState(value);
  const at = useRef(value);

  useEffect(() => {
    if (reducedMotion()) return;
    const from = at.current;
    if (from === value) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      at.current = from + (value - from) * (1 - Math.pow(1 - p, 3));
      setShown(at.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return reducedMotion() ? value : shown;
}
