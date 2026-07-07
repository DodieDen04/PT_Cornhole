const W = 320;
const H = 110;
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18;

// points: [{ value, mode, throws, count }] oldest first.
// unit: 'pct' | 'raw'. colour: line colour hex.
export default function TrendChart({ points = [], unit = 'pct', colour = '#FFD700' }) {
  if (!points || points.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-ink/15 p-4 text-center text-sm text-ink/60">
        No games in this period yet.
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max =
    unit === 'pct'
      ? Math.max(50, ...points.map((p) => p.value))
      : Math.max(4, ...points.map((p) => p.value));

  const xFor = (i) =>
    PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yFor = (v) => PAD_T + innerH - (v / max) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`)
    .join(' ');

  const gridYValues = [0, Math.round(max / 2), Math.round(max)];
  const suffix = unit === 'pct' ? '%' : '';

  return (
    <div className="rounded-xl bg-surface border border-ink/15 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {gridYValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="currentColor"
              strokeOpacity="0.12"
            />
            <text
              x={PAD_L - 4}
              y={yFor(v) + 3}
              textAnchor="end"
              fontSize="8"
              fill="currentColor"
              opacity="0.55"
            >
              {v}
              {suffix}
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke={colour} strokeWidth="1.6" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r="2.5"
            fill={p.mode === 'COMPETITIVE' ? colour : '#3B82F6'}
            stroke="#0C447C"
            strokeWidth="0.5"
          >
            <title>
              {p.mode} &middot; {p.value}
              {suffix} &middot; {p.count} of {p.throws} throws
            </title>
          </circle>
        ))}

        <text x={PAD_L} y={H - 4} fontSize="8" fill="currentColor" opacity="0.55">
          Earliest
        </text>
        <text
          x={W - PAD_R}
          y={H - 4}
          fontSize="8"
          fill="currentColor"
          opacity="0.55"
          textAnchor="end"
        >
          Latest
        </text>
      </svg>
      <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider text-ink/60">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: colour }} /> Competitive
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Practice
        </span>
      </div>
    </div>
  );
}
