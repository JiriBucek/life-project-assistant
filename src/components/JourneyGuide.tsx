/**
 * The "how LUMA works" picture: a rising spiral after Campbell's hero's
 * journey. Each turn of the coil is one project — a wish appears, the project
 * begins, the messy middle, reflection, the project ends — and every return
 * lands a little higher: life satisfaction grows, a new wish appears.
 * Life areas are the ground the spiral rises from; values are the fixed
 * stars it steers by — both deliberately off the road itself.
 */

// A numbered station on the road — the soft ordering of the journey's beats.
// One shared shape so every stop speaks the same language; only the wish
// stars at the loop's start and end stand apart.
function Station({ n, x, y, color }: { n: number; x: number; y: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={8} fill="var(--paper-raised)" stroke={color} strokeWidth={1.75} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
        {n}
      </text>
    </g>
  );
}

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
      viewBox="0 0 600 490"
      className="h-auto w-full"
      role="img"
      aria-label="The LUMA journey as a rising spiral: your values shine at the very top, your life carries the very bottom with your life areas as its ground, and between them each project turns the coil — a wish appears, a project begins, the messy middle, reflection, the project ends, life satisfaction grows, and a new wish appears one turn higher."
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

      {/* The coil and its story beats, held between values and life areas —
          dropped well below the values, so the stars keep their own sky above
          the material journey */}
      <g transform="translate(0 60)">
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

        {/* a wish appears — right on the spiral's mouth, where the road begins */}
        <g transform="translate(95 252)">
          <polygon points={starPoints(15, 6)} fill="var(--clay)" />
        </g>
        <text x={95} y={290} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--clay)">
          a wish appears
        </text>

        {/* The beats, numbered along the road — begin, struggle, pause, end,
            grow — with the wish stars bracketing them at either mouth */}
        <Station n={1} x={300} y={282} color="var(--periwinkle-deep)" />
        <text x={300} y={312} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--periwinkle-deep)">
          a project begins
        </text>

        <Station n={2} x={458} y={268} color="var(--sage)" />
        <text x={458} y={312} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          the messy middle
        </text>

        <Station n={3} x={300} y={207} color="var(--sage)" />
        <text x={300} y={237} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          reflection
        </text>

        <Station n={4} x={300} y={141} color="var(--sage)" />
        <text x={300} y={171} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          the project ends
        </text>

        <Station n={5} x={415} y={122} color="var(--sage)" />
        <text x={428} y={127} textAnchor="start" fontSize={12.5} fontWeight={600} fill="var(--sage)">
          life satisfaction grows
        </text>

        {/* the new wish — the coil's open end, mirroring the journey's start:
            same star (a touch smaller, so the coil's end stays visible), same
            voice, so the ending reads as a new beginning. The label floats
            up-right, clear of the coil's last turn. */}
        <polygon points={starPoints(12, 4.8)} fill="var(--clay)" transform="translate(302 62)" />
        <text x={330} y={54} textAnchor="start" fontSize={12.5} fontWeight={600} fill="var(--clay)">
          …and a new wish appears
        </text>
      </g>

      {/* The ground at the very bottom: the life areas stand on a soft
          horizon, and beneath it lies your life — rooted by its own quiet
          constellation, mirroring the values that crown the sky above */}
      <text x={300} y={416} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--sky)">
        your life areas
      </text>
      {/* The ground — straight and wider than the spiral's widest turn, like
          the plate a cake stands on */}
      <path
        d="M 60 438 L 540 438"
        fill="none"
        stroke="var(--sky)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.35}
      />
      {/* Same voice as the dialog's "How LUMA works" title (serif, medium,
          ink), and all caps — so it reads like LUMA's own name does. The SVG
          scales ~1.2× at the dialog's width, so 16.7 units render at the
          title's actual 20px. */}
      <text x={300} y={472} textAnchor="middle" fontSize={16.7} fontWeight={500} className="font-serif" fill="var(--ink)">
        YOUR LIFE
      </text>
    </svg>
  );
}
