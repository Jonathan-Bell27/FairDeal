// Hand-drawn red-pen marks. Paths use pathLength="1" so CSS can animate
// them being drawn with stroke-dashoffset.

export function PenCircle({ className = "" }) {
  return (
    <svg className={`pen-circle ${className}`} viewBox="0 0 120 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        pathLength="1"
        d="M64 7 C97 5 117 27 112 53 C107 81 79 96 50 93 C20 90 3 70 8 45 C13 20 37 6 70 10"
      />
    </svg>
  );
}

export function PenSquiggle({ className = "" }) {
  return (
    <svg className={`pen-squiggle ${className}`} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength="1" d="M2 6 Q 18 1 34 5 T 66 5 T 98 4 T 118 5" />
    </svg>
  );
}
