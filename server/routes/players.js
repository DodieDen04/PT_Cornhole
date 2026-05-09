const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin, publicPlayer } = require('../lib/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const players = await prisma.player.findMany({ orderBy: { username: 'asc' } });
  res.json({ players: players.map(publicPlayer) });
});

router.get('/:id', authenticate, async (req, res) => {
  const player = await prisma.player.findUnique({ where: { id: req.params.id } });
  if (!player) return res.status(404).json({ error: 'Not found' });
  res.json({ player: publicPlayer(player) });
});

router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.player.id !== id && !req.player.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { username, pin } = req.body || {};
  const data = {};
  if (username) data.username = username.trim();
  if (pin) {
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });
    data.pinHash = await bcrypt.hash(pin, 10);
  }
  const updated = await prisma.player.update({ where: { id }, data });
  res.json({ player: publicPlayer(updated) });
});

router.post('/:id/reset-pin', authenticate, requireAdmin, async (req, res) => {
  const { newPin } = req.body || {};
  if (!/^\d{4}$/.test(newPin || '')) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }
  const pinHash = await bcrypt.hash(newPin, 10);
  await prisma.player.update({ where: { id: req.params.id }, data: { pinHash } });
  res.json({ ok: true });
});

router.post('/:id/make-admin', authenticate, requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.player.id) return res.status(400).json({ error: 'Already admin' });
  await prisma.$transaction([
    prisma.player.update({ where: { id: req.player.id }, data: { isAdmin: false } }),
    prisma.player.update({ where: { id: targetId }, data: { isAdmin: true } }),
  ]);
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (req.params.id === req.player.id) {
    return res.status(400).json({ error: "Can't delete yourself" });
  }
  await prisma.player.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
