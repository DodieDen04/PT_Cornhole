const W = 320;
const H = 110;
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18;

export default function TrendChart({ trend = [] }) {
  if (!trend || trend.length === 0) {
    return (
      <div className="rounded-xl bg-[#082F58] border border-[#FAEEDA]/15 p-4 text-center text-sm text-[#FAEEDA]/60">
        Play a few games to see your accuracy trend.
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(50, ...trend.map((t) => t.cornholePct));

  const xFor = (i) =>
    PAD_L + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
  const yFor = (v) => PAD_T + innerH - (v / max) * innerH;

  const linePath = trend
    .map((t, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(t.cornholePct)}`)
    .join(' ');

  const gridYValues = [0, Math.round(max / 2), Math.round(max)];

  return (
    <div className="rounded-xl bg-[#082F58] border border-[#FAEEDA]/15 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {gridYValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="#FAEEDA"
              strokeOpacity="0.12"
            />
            <text
              x={PAD_L - 4}
              y={yFor(v) + 3}
              textAnchor="end"
              fontSize="8"
              fill="#FAEEDA"
              opacity="0.55"
            >
              {v}%
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke="#FFD700" strokeWidth="1.6" strokeLinejoin="round" />

        {trend.map((t, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(t.cornholePct)}
            r="2.5"
            fill={t.mode === 'COMPETITIVE' ? '#FFD700' : '#3B82F6'}
            stroke="#0C447C"
            strokeWidth="0.5"
          >
            <title>
              {t.mode} &middot; {t.cornholePct}% cornhole &middot; {t.throws} throws
            </title>
          </circle>
        ))}

        <text
          x={PAD_L}
          y={H - 4}
          fontSize="8"
          fill="#FAEEDA"
          opacity="0.55"
        >
          Earliest
        </text>
        <text
          x={W - PAD_R}
          y={H - 4}
          fontSize="8"
          fill="#FAEEDA"
          opacity="0.55"
          textAnchor="end"
        >
          Latest
        </text>
      </svg>
      <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider text-[#FAEEDA]/60">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#FFD700]" /> Competitive
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Practice
        </span>
      </div>
    </div>
  );
}
