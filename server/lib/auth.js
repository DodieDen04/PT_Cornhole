const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set');
}

function signToken(playerId) {
  return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const player = await prisma.player.findUnique({ where: { id: decoded.playerId } });
    if (!player) return res.status(401).json({ error: 'Invalid token' });
    req.player = player;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.player || !req.player.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

function publicPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    username: player.username,
    isAdmin: player.isAdmin,
    createdAt: player.createdAt,
  };
}

module.exports = { signToken, authenticate, requireAdmin, publicPlayer };
