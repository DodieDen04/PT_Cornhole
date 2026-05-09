import { useCallback, useEffect, useRef, useState } from 'react';
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
  classifyThrow,
  clamp01,
} from '../constants/board.js';
import { BAG_HEX } from '../constants/colours.js';

const HOLD_MS = 200;
const BAG_RADIUS_NORM = 0.04;

function svgToNorm(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const inv = ctm.inverse();
  const local = pt.matrixTransform(inv);
  return { x: local.x / VIEWBOX_W, y: local.y / VIEWBOX_H };
}

export default function Board({ bags, onPlace, onMove, disabled }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const holdTimer = useRef(null);
  const dragStartedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  function handlePointerDown(e) {
    if (disabled) return;
    const target = e.target;
    const bagId = target?.getAttribute?.('data-bag-id');
    if (!bagId) return;
    e.preventDefault();
    e.stopPropagation();
    cancelHold();
    dragStartedRef.current = false;
    holdTimer.current = setTimeout(() => {
      dragStartedRef.current = true;
      const norm = svgToNorm(svgRef.current, e.clientX, e.clientY);
      if (!norm) return;
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
      setDrag({ bagId, x: clamp01(norm.x), y: clamp01(norm.y), pointerId: e.pointerId });
      if (navigator.vibrate) navigator.vibrate(15);
    }, HOLD_MS);
  }

  function handlePointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const norm = svgToNorm(svgRef.current, e.clientX, e.clientY);
    if (!norm) return;
    setDrag({ ...drag, x: clamp01(norm.x), y: clamp01(norm.y) });
  }

  function handlePointerUp(e) {
    cancelHold();
    if (drag && drag.pointerId === e.pointerId) {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch {}
      onMove && onMove(drag.bagId, drag.x, drag.y);
      setDrag(null);
      dragStartedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (dragStartedRef.current) {
      dragStartedRef.current = false;
      return;
    }
    const target = e.target;
    if (target?.getAttribute?.('data-bag-id')) return;
    const norm = svgToNorm(svgRef.current, e.clientX, e.clientY);
    if (!norm) return;
    const x = clamp01(norm.x);
    const y = clamp01(norm.y);
    onPlace && onPlace(x, y);
  }

  function handlePointerCancel(e) {
    cancelHold();
    if (drag && drag.pointerId === e.pointerId) {
      setDrag(null);
    }
  }

  useEffect(() => () => cancelHold(), [cancelHold]);

  const seenBagsRef = useRef(null);
  if (seenBagsRef.current === null) seenBagsRef.current = new Set();

  const renderedBags = bags.map((bag) => {
    const isNew = !seenBagsRef.current.has(bag.id);
    if (drag && drag.bagId === bag.id) {
      return { ...bag, boardX: drag.x, boardY: drag.y, dragging: true, justPlaced: false };
    }
    return { ...bag, justPlaced: isNew };
  });

  useEffect(() => {
    for (const b of bags) seenBagsRef.current.add(b.id);
  });

  const dropZone = drag ? classifyThrow(drag.x, drag.y).result : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      className="w-full max-w-md mx-auto block touch-none select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <rect
        x="0"
        y="0"
        width={VIEWBOX_W}
        height={VIEWBOX_H}
        fill="#DC2626"
      />
      <rect
        x="0"
        y="0"
        width={VIEWBOX_W}
        height={VIEWBOX_H}
        fill="none"
        stroke={dropZone === 'OFF' ? '#EF4444' : 'transparent'}
        strokeWidth="1.2"
      />
      <rect
        x={BOARD_X_MIN * VIEWBOX_W}
        y={BOARD_Y_MIN * VIEWBOX_H}
        width={(BOARD_X_MAX - BOARD_X_MIN) * VIEWBOX_W}
        height={(BOARD_Y_MAX - BOARD_Y_MIN) * VIEWBOX_H}
        fill="#D4B58F"
        stroke={dropZone === 'BOARD' ? '#3B82F6' : '#A88B6A'}
        strokeWidth={dropZone === 'BOARD' ? '0.8' : '0.3'}
        rx="1.5"
      />
      <line
        x1={BOARD_X_MIN * VIEWBOX_W}
        y1={(BOARD_Y_MIN + (BOARD_Y_MAX - BOARD_Y_MIN) * 0.5) * VIEWBOX_H}
        x2={BOARD_X_MAX * VIEWBOX_W}
        y2={(BOARD_Y_MIN + (BOARD_Y_MAX - BOARD_Y_MIN) * 0.5) * VIEWBOX_H}
        stroke="#A88B6A"
        strokeWidth="0.2"
        opacity="0.4"
      />
      <circle
        cx={HOLE_CENTRE_X * VIEWBOX_W}
        cy={HOLE_CENTRE_Y * VIEWBOX_H}
        r={HOLE_RADIUS * VIEWBOX_W * 1.4}
        fill="none"
        stroke="#5A4429"
        strokeWidth="0.6"
        opacity="0.7"
      />
      <circle
        cx={HOLE_CENTRE_X * VIEWBOX_W}
        cy={HOLE_CENTRE_Y * VIEWBOX_H}
        r={HOLE_RADIUS * VIEWBOX_W}
        fill="#0a0a0a"
        stroke={dropZone === 'CORNHOLE' ? '#22C55E' : 'transparent'}
        strokeWidth="0.8"
      />
      <text
        x={VIEWBOX_W / 2}
        y={VIEWBOX_H * 0.05}
        fill="#FAEEDA"
        fontSize="3"
        textAnchor="middle"
        opacity="0.5"
      >
        Tap red zone for off-board miss
      </text>

      {renderedBags.map((bag) => {
        const colour = BAG_HEX[bag.colour] || '#FFD700';
        const cx = bag.boardX * VIEWBOX_W;
        const cy = bag.boardY * VIEWBOX_H;
        const isCornhole = bag.result === 'CORNHOLE' && !bag.dragging;
        const fullR = BAG_RADIUS_NORM * VIEWBOX_W;
        const radius = isCornhole ? fullR * 0.4 : fullR;
        return (
          <g
            key={bag.id}
            data-bag-id={isCornhole ? undefined : bag.id}
            style={{
              pointerEvents: isCornhole ? 'none' : 'all',
              transition: 'opacity 280ms ease-out',
              opacity: isCornhole ? 0.55 : 1,
            }}
          >
            <circle
              data-bag-id={isCornhole ? undefined : bag.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill={colour}
              stroke="#1a1a1a"
              strokeWidth={bag.dragging ? '0.6' : '0.4'}
              className={bag.justPlaced ? 'bag-drop-in' : undefined}
              style={{
                transition: 'r 280ms ease-out',
                filter: bag.dragging
                  ? 'drop-shadow(0 0 1.5px rgba(255,255,255,0.7))'
                  : 'drop-shadow(0 0.4px 0.6px rgba(0,0,0,0.5))',
                ['--bag-r-target']: radius,
              }}
            />
            {bag.label && !isCornhole && (
              <text
                data-bag-id={bag.id}
                x={cx}
                y={cy + 0.6}
                fontSize="1.6"
                textAnchor="middle"
                fill="#0a0a0a"
                fontWeight="700"
                pointerEvents="none"
              >
                {bag.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
