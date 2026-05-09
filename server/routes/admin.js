const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../lib/auth');

const router = express.Router();

router.post('/reset-data', authenticate, requireAdmin, async (req, res) => {
  await prisma.$transaction([
    prisma.bagThrow.deleteMany({}),
    prisma.practiceSet.deleteMany({}),
    prisma.round.deleteMany({}),
    prisma.gameResult.deleteMany({}),
    prisma.gamePlayer.deleteMany({}),
    prisma.game.deleteMany({}),
  ]);
  res.json({ ok: true });
});

module.exports = router;
