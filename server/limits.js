// Per-visitor rate limit so a stranger can't spend the API credits.
// In memory: resets when the server restarts, which is fine for a demo.
export function rateLimit({ max, windowMs, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: message });
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
