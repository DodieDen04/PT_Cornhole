const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { classifyThrow } = require('../lib/board');

const router = express.Router();

router.post('/games/:id/sets', authenticate, async (req, res) => {
  const gameId = req.params.id;
  const { throws, tag } = req.body || {};
  if (!Array.isArray(throws) || throws.length === 0) {
    return res.status(400).json({ error: 'At least one throw required' });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { practiceSets: true, players: true },
  });
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.mode !== 'PRACTICE') return res.status(400).json({ error: 'Not a practice game' });
  if (game.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Game is not in progress' });

  const validPlayerIds = new Set(game.players.map((gp) => gp.playerId));
  for (const t of throws) {
    if (!validPlayerIds.has(t.playerId)) {
      return res.status(400).json({ error: 'Invalid playerId in throws' });
    }
    if (typeof t.boardX !== 'number' || typeof t.boardY !== 'number') {
      return res.status(400).json({ error: 'Each throw needs boardX/boardY' });
    }
  }

  const byPlayer = {};
  for (const t of throws) {
    if (!byPlayer[t.playerId]) byPlayer[t.playerId] = [];
    byPlayer[t.playerId].push(t);
  }

  const created = [];
  for (const [playerId, playerThrows] of Object.entries(byPlayer)) {
    const setsForPlayer = await prisma.practiceSet.count({ where: { gameId, playerId } });
    const setNumber = setsForPlayer + 1;
    const set = await prisma.practiceSet.create({
      data: {
        gameId,
        playerId,
        setNumber,
        tag: tag || null,
        bagThrows: {
          create: playerThrows.map((t, i) => {
            const c = classifyThrow(t.boardX, t.boardY);
            return {
              gameId,
              playerId,
              throwOrder: i + 1,
              boardX: t.boardX,
              boardY: t.boardY,
              result: c.result,
              points: c.points,
            };
          }),
        },
      },
      include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
    });
    created.push(set);
  }

  res.json({ sets: created });
});

router.get('/games/:id/sets', authenticate, async (req, res) => {
  const sets = await prisma.practiceSet.findMany({
    where: { gameId: req.params.id },
    orderBy: [{ playerId: 'asc' }, { setNumber: 'asc' }],
    include: { bagThrows: { orderBy: { throwOrder: 'asc' } }, player: true },
  });
  res.json({ sets });
});

module.exports = router;
