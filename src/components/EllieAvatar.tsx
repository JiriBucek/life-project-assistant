/**
 * Ellie's avatar — a hand-drawn sun-headed figure (spiral face, rays, two
 * little legs), redrawn from the user's reference doodle. Strokes only, no
 * background, in the brand blue. The head slowly rotates (see .ellie-avatar-head
 * in globals.css) so she feels alive.
 */
export function EllieAvatar({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 125"
      className={className}
      role="img"
      aria-label="LUMA — a little figure with a spinning sun for a head"
      fill="none"
      stroke="var(--sage)"
      strokeWidth={5}
      strokeLinecap="round"
    >
      {/* Head (spiral + rays), centered so it can spin in place */}
      <g transform="translate(60 47)">
        <g className="ellie-avatar-head">
          {/* Squarish spiral face */}
          <path
            d="M -18 -19 C -5 -25, 15 -23, 20 -9 C 24 5, 20 19, 5 21
               C -8 23, -20 15, -18 3 C -16 -7, -6 -11, 2 -7
               C 9 -3, 8 5, 1 7 C -4 8, -8 5, -5 0"
          />
          {/* Rays — uneven on purpose, like quick pen strokes */}
          <path d="M 0 -28 L 0 -40" />
          <path d="M 20 -20 L 29 -29" />
          <path d="M -20 -20 L -29 -29" />
          <path d="M 28 0 L 40 0" />
          <path d="M -28 0 L -40 0" />
          <path d="M 23 14 L 33 20" />
          <path d="M -23 14 L -33 20" />
          {/* A stray little dot, as in the doodle */}
          <circle cx={36} cy={26} r={1.5} fill="var(--sage)" stroke="none" />
        </g>
      </g>

      {/* Legs stay put while the head turns */}
      <path d="M 54 76 C 53 88, 53 96, 51 103 C 49 109, 40 110, 33 106" />
      <path d="M 67 76 C 67 90, 67 100, 67 108 C 67 112, 73 113, 80 110" />
    </svg>
  );
}
