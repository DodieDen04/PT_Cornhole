export const HOLE_CENTRE_X = 0.5;
export const HOLE_CENTRE_Y = 0.275;
export const HOLE_RADIUS = 0.105;

export const BOARD_X_MIN = 0.15;
export const BOARD_X_MAX = 0.85;
export const BOARD_Y_MIN = 0.10;
export const BOARD_Y_MAX = 0.90;

export const VIEWBOX_W = 100;
export const VIEWBOX_H = 177;

export function classifyThrow(x, y) {
  const aspect = VIEWBOX_H / VIEWBOX_W;
  const dx = x - HOLE_CENTRE_X;
  const dy = (y - HOLE_CENTRE_Y) * aspect;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= HOLE_RADIUS) return { result: 'CORNHOLE', points: 3 };
  if (x >= BOARD_X_MIN && x <= BOARD_X_MAX && y >= BOARD_Y_MIN && y <= BOARD_Y_MAX) {
    return { result: 'BOARD', points: 1 };
  }
  return { result: 'OFF', points: 0 };
}

export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export function snapToGutterEdge(x, y) {
  const cx = clamp01(x);
  const cy = clamp01(y);
  if (cx === x && cy === y) return { x: cx, y: cy };
  return { x: cx, y: cy };
}
