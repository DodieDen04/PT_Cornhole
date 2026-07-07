import { useMemo } from 'react';
import {
  HOLE_CENTRE_X,
  HOLE_CENTRE_Y,
  HOLE_RADIUS,
  BOARD_X_MIN,
  BOARD_X_MAX,
  BOARD_Y_MIN,
  BOARD_Y_MAX,
  VIEWBOX_W,
  VIEWBOX_H,
} from '../constants/board.js';

const GRID_X = 26;
const GRID_Y = 46;

export const HEAT_STOPS = [
  { fill: '#1D4ED8', alpha: 0.35 },
  { fill: '#3B82F6', alpha: 0.5 },
  { fill: '#22D3EE', alpha: 0.55 },
  { fill: '#FBBF24', alpha: 0.65 },
  { fill: '#F97316', alpha: 0.75 },
  { fill: '#DC2626', alpha: 0.85 },
  { fill: '#7F1D1D', alpha: 0.95 },
];

function quantileColour(rank) {
  const idx = Math.min(
    HEAT_STOPS.length - 1,
    Math.floor(rank * HEAT_STOPS.length),
  );
  return HEAT_STOPS[idx];
}

function buildGrid(throws) {
  const cells = new Array(GRID_X * GRID_Y).fill(0);
  for (const t of throws) {
    const cx = Math.min(GRID_X - 1, Math.max(0, Math.floor(t.x * GRID_X)));
    const cy = Math.min(GRID_Y - 1, Math.max(0, Math.floor(t.y * GRID_Y)));
    cells[cy * GRID_X + cx] += 1;
  }
  return cells;
}

function quantileRanks(cells) {
  const positives = cells.filter((c) => c > 0).sort((a, b) => a - b);
  if (positives.length === 0) return null;
  const rankMap = new Map();
  for (let i = 0; i < positives.length; i++) {
    if (!rankMap.has(positives[i])) {
      rankMap.set(positives[i], (i + 1) / positives.length);
    }
  }
  return rankMap;
}

export default function Heatmap({ throws = [], showBoardOutline = true, className }) {
  const cellW = VIEWBOX_W / GRID_X;
  const cellH = VIEWBOX_H / GRID_Y;

  const { cells, rankMap, hasData } = useMemo(() => {
    const cells = buildGrid(throws);
    const rankMap = quantileRanks(cells);
    return { cells, rankMap, hasData: rankMap !== null };
  }, [throws]);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      className={'w-full max-w-md mx-auto block ' + (className || '')}
    >
      <rect x="0" y="0" width={VIEWBOX_W} height={VIEWBOX_H} fill="#DC2626" />
      <rect
        x={BOARD_X_MIN * VIEWBOX_W}
        y={BOARD_Y_MIN * VIEWBOX_H}
        width={(BOARD_X_MAX - BOARD_X_MIN) * VIEWBOX_W}
        height={(BOARD_Y_MAX - BOARD_Y_MIN) * VIEWBOX_H}
        fill="#D4B58F"
        opacity="0.9"
        rx="1.5"
      />
      <circle
        cx={HOLE_CENTRE_X * VIEWBOX_W}
        cy={HOLE_CENTRE_Y * VIEWBOX_H}
        r={HOLE_RADIUS * VIEWBOX_W}
        fill="#0a0a0a"
        opacity="0.7"
      />

      {hasData &&
        cells.map((count, i) => {
          if (count === 0) return null;
          const x = i % GRID_X;
          const y = Math.floor(i / GRID_X);
          const rank = rankMap.get(count);
          const { fill, alpha } = quantileColour(rank);
          return (
            <rect
              key={i}
              x={x * cellW}
              y={y * cellH}
              width={cellW}
              height={cellH}
              fill={fill}
              opacity={alpha}
            />
          );
        })}

      {showBoardOutline && (
        <rect
          x={BOARD_X_MIN * VIEWBOX_W}
          y={BOARD_Y_MIN * VIEWBOX_H}
          width={(BOARD_X_MAX - BOARD_X_MIN) * VIEWBOX_W}
          height={(BOARD_Y_MAX - BOARD_Y_MIN) * VIEWBOX_H}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="0.4"
          rx="1.5"
        />
      )}
      <circle
        cx={HOLE_CENTRE_X * VIEWBOX_W}
        cy={HOLE_CENTRE_Y * VIEWBOX_H}
        r={HOLE_RADIUS * VIEWBOX_W}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.4"
      />

      {!hasData && (
        <text
          x={VIEWBOX_W / 2}
          y={VIEWBOX_H / 2}
          fill="currentColor"
          fontSize="4"
          textAnchor="middle"
          opacity="0.5"
        >
          No throws yet
        </text>
      )}
    </svg>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] uppercase tracking-wider text-ink/60">
      <span className="mr-0.5">Less</span>
      {HEAT_STOPS.map((s, i) => (
        <span
          key={i}
          className="w-3 h-3 rounded-sm"
          style={{ background: s.fill, opacity: s.alpha }}
        />
      ))}
      <span className="ml-0.5">More</span>
    </div>
  );
}
