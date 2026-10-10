import { useMemo } from "react";
import { qrMatrix } from "./share.js";

// A QR code as one SVG path. Always black on white, even in dark mode,
// because phone cameras read dark-on-light codes most reliably.
export default function QR({ text, label }) {
  const code = useMemo(() => {
    const matrix = qrMatrix(text);
    if (!matrix) return null; // too long for a QR code
    const { size, isDark } = matrix;
    let d = "";
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) if (isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
    return { size: size + 8, d };
  }, [text]);

  if (!code) return null;
  const { size, d } = code;
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
