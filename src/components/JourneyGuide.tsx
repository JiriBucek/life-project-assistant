/**
 * The "how LUMA works" picture: a rising spiral after Campbell's hero's
 * journey. Each turn of the coil is one project — a wish appears, the project
 * begins, the messy middle, reflection — and every return lands a little
 * higher: life satisfaction grows, the project ends, a new wish appears.
 * Life areas are the ground the spiral rises from; values are the fixed
 * stars it steers by — both deliberately off the road itself.
 */

// Two concentric 8-point stars (outer + rotated inner) for star marks.
function starPoints(R: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const b = a + Math.PI / 8;
    pts.push(`${(R * Math.cos(a)).toFixed(1)},${(R * Math.sin(a)).toFixed(1)}`);
    pts.push(`${(r * Math.cos(b)).toFixed(1)},${(r * Math.sin(b)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// The coil, drawn as three front arcs (the road) and three back arcs (the
// turns passing behind), rising from bottom-left to the open sky at the top.
const FRONT = [
  "M 95 252 C 165 292, 435 292, 505 252",
  "M 140 182 C 200 216, 400 216, 460 182",
  "M 180 122 C 228 148, 372 148, 415 122",
];
const BACK = [
  "M 505 252 C 575 210, 435 162, 140 182",
  "M 460 182 C 520 146, 390 112, 180 122",
  "M 415 122 C 455 98, 380 70, 302 62",
];

export function JourneyGuide() {
  return (
    <svg
      viewBox="0 0 600 388"
      className="h-auto w-full"
      role="img"
      aria-label="The LUMA journey as a rising spiral: your values shine at the very top, your life areas ground the very bottom, and between them each project turns the coil — a wish appears, a project begins, the messy middle, reflection, life satisfaction grows, the project ends, and a new wish appears one turn higher."
    >
      {/* The summit — your values, the fixed stars at the very top */}
      <g fill="var(--gold)">
        <polygon points={starPoints(6, 2.4)} transform="translate(288 18)" />
        <polygon points={starPoints(4.5, 1.8)} transform="translate(318 12)" opacity={0.7} />
        <polygon points={starPoints(3.5, 1.4)} transform="translate(304 34)" opacity={0.6} />
      </g>
      <text x={300} y={57} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--gold-deep)">
        your values
      </text>
      <text x={300} y={70} textAnchor="middle" fontSize={10.5} fill="var(--ink-faint)">
        the stars you steer by
      </text>

      {/* The coil and its story beats, held between values and life areas */}
      <g transform="translate(0 28)">
        {/* Back arcs — the coil passing behind itself */}
        {BACK.map((d, i) => (
          <path
            key={`back-${i}`}
            d={d}
            fill="none"
            stroke="var(--periwinkle)"
            strokeWidth={9 - i}
            strokeLinecap="round"
            opacity={0.28}
          />
        ))}

        {/* Front arcs — the stitched road */}
        {FRONT.map((d, i) => (
          <g key={`front-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="var(--periwinkle-tint)"
              strokeWidth={20 - i * 2}
              strokeLinecap="round"
            />
            <path
              d={d}
              fill="none"
              stroke="var(--periwinkle-deep)"
              strokeWidth={2.2}
              strokeDasharray="8 7"
              strokeLinecap="round"
              opacity={0.7}
            />
          </g>
        ))}

        {/* a wish appears — where every journey starts */}
        <g transform="translate(68 250)">
          <polygon points={starPoints(15, 6)} fill="var(--clay)" />
        </g>
        <text x={68} y={288} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--clay)">
          a wish appears
        </text>

        {/* a project begins — first turn of the coil */}
        <path d="M 245 277 L 256 282.5 L 245 288 Z" fill="var(--periwinkle-deep)" />
        <text x={250} y={312} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--periwinkle-deep)">
          a project begins
        </text>

        {/* the messy middle — a little tangle on the road */}
        <path
          d="M 416 270 c 6 -8, 13 1, 7 6 c -6 5, -2 10, 7 6 c 8 -3, 11 3, 5 8"
          fill="none"
          stroke="var(--sage)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text x={432} y={312} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          the messy middle
        </text>

        {/* reflection — the quiet stop on the second turn */}
        <circle cx={300} cy={207} r={6} fill="var(--paper-raised)" stroke="var(--sage)" strokeWidth={2} />
        <text x={300} y={237} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          reflection
        </text>

        {/* the return, higher — satisfaction, the ending, the new wish */}
        <text x={296} y={106} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--sage)">
          life satisfaction grows
        </text>
        <circle cx={415} cy={122} r={5} fill="var(--periwinkle-deep)" stroke="var(--paper-raised)" strokeWidth={2} />
        <text x={438} y={127} textAnchor="start" fontSize={12.5} fontWeight={600} fill="var(--periwinkle-deep)">
          the project ends
        </text>

        {/* the new wish — right at the coil's open end, just below the values */}
        <polygon points={starPoints(7, 2.8)} fill="var(--clay)" transform="translate(302 62)" />
        <text x={330} y={64} textAnchor="start" fontSize={12} fontStyle="italic" className="font-serif" fill="var(--ink-soft)">
          …and a new wish appears
        </text>
      </g>

      {/* The ground at the very bottom — your life areas */}
      <text x={300} y={378} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sky)">
        your life areas
      </text>
    </svg>
  );
}
