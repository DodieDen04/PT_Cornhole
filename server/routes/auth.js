const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken, authenticate, publicPlayer } = require('../lib/auth');

const router = express.Router();

function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

router.post('/register', async (req, res) => {
  const { username, pin } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  if (!isValidPin(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }

  const trimmed = username.trim();
  const existing = await prisma.player.findUnique({ where: { username: trimmed } });
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const playerCount = await prisma.player.count();
  const pinHash = await bcrypt.hash(pin, 10);
  const player = await prisma.player.create({
    data: { username: trimmed, pinHash, isAdmin: playerCount === 0 },
  });
  const token = signToken(player.id);
  res.json({ token, player: publicPlayer(player) });
});

router.post('/login', async (req, res) => {
  const { username, pin } = req.body || {};
  if (!username || !isValidPin(pin)) {
    return res.status(400).json({ error: 'Username and 4-digit PIN required' });
  }
  const player = await prisma.player.findUnique({ where: { username: username.trim() } });
  if (!player || !player.pinHash) {
    return res.status(401).json({ error: 'Invalid username or PIN' });
  }
  const ok = await bcrypt.compare(pin, player.pinHash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or PIN' });
  const token = signToken(player.id);
  res.json({ token, player: publicPlayer(player) });
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ player: publicPlayer(req.player) });
});

router.get('/first-run', async (req, res) => {
  const playerCount = await prisma.player.count();
  res.json({ firstRun: playerCount === 0 });
});

module.exports = router;
