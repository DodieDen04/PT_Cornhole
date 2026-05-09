const HOLE_CENTRE_X = 0.5;
const HOLE_CENTRE_Y = 0.275;
const HOLE_RADIUS = 0.105;

const BOARD_X_MIN = 0.15;
const BOARD_X_MAX = 0.85;
const BOARD_Y_MIN = 0.10;
const BOARD_Y_MAX = 0.90;

const VIEWBOX_W = 100;
const VIEWBOX_H = 177;

function classifyThrow(x, y) {
  const aspect = VIEWBOX_H / VIEWBOX_W;
  const dx = x - HOLE_CENTRE_X;
  const dy = (y - HOLE_CENTRE_Y) * aspect;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= HOLE_RADIUS) {
    return { result: 'CORNHOLE', points: 3 };
  }
  if (x >= BOARD_X_MIN && x <= BOARD_X_MAX && y >= BOARD_Y_MIN && y <= BOARD_Y_MAX) {
    return { result: 'BOARD', points: 1 };
  }
  return { result: 'OFF', points: 0 };
}

module.exports = {
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
};
