const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { classifyThrow } = require('../lib/board');
const { recalcRound, getGameTotals } = require('../lib/scoring');
const { broadcastGameUpdate } = require('../lib/spectator');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  const { gameId, roundId, playerId, boardX, boardY } = req.body || {};
  if (!gameId || !playerId || typeof boardX !== 'number' || typeof boardY !== 'number') {
    return res.status(400).json({ error: 'gameId, playerId, boardX, boardY required' });
  }
  if (!roundId) {
    return res.status(400).json({ error: 'roundId required (practice uses POST /games/:id/sets)' });
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { bagThrows: true, game: { include: { rounds: true } } },
  });
  if (!round || round.gameId !== gameId) {
    return res.status(400).json({ error: 'Round/game mismatch' });
  }
  if (round.game.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Game is not in progress' });
  }
  const maxRoundNumber = round.game.rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0);
  if (round.roundNumber !== maxRoundNumber) {
    return res.status(400).json({ error: 'Round is no longer active' });
  }
  if (round.bagThrows.length >= 8) {
    return res.status(400).json({ error: 'Round already has 8 throws' });
  }

  const { result, points } = classifyThrow(boardX, boardY);
  const throwOrder = round.bagThrows.length + 1;

  await prisma.bagThrow.create({
    data: { gameId, roundId, playerId, throwOrder, boardX, boardY, result, points },
  });
  const updatedRound = await recalcRound(roundId);
  const totals = await getGameTotals(gameId);

  const refreshed = await prisma.round.findUnique({
    where: { id: roundId },
    include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
  });
  broadcastGameUpdate(gameId, { round: refreshed, totals });
  res.json({ round: refreshed, totals });
});

router.put('/:id', authenticate, async (req, res) => {
  const { boardX, boardY } = req.body || {};
  if (typeof boardX !== 'number' || typeof boardY !== 'number') {
    return res.status(400).json({ error: 'boardX, boardY required' });
  }
  const existing = await prisma.bagThrow.findUnique({
    where: { id: req.params.id },
    include: { round: { include: { game: true } }, practiceSet: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { result, points } = classifyThrow(boardX, boardY);
  await prisma.bagThrow.update({
    where: { id: req.params.id },
    data: { boardX, boardY, result, points },
  });

  if (existing.roundId) {
    await recalcRound(existing.roundId);
    const refreshed = await prisma.round.findUnique({
      where: { id: existing.roundId },
      include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
    });
    const totals = await getGameTotals(existing.gameId);
    broadcastGameUpdate(existing.gameId, { round: refreshed, totals });
    return res.json({ round: refreshed, totals });
  }
  const updated = await prisma.bagThrow.findUnique({ where: { id: req.params.id } });
  res.json({ throw: updated });
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await prisma.bagThrow.findUnique({
    where: { id: req.params.id },
    include: {
      round: { include: { bagThrows: { orderBy: { throwOrder: 'desc' } }, game: { include: { rounds: true } } } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  if (existing.roundId) {
    const round = existing.round;
    if (round.game.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Cannot undo a finished game' });
    }
    const maxRoundNumber = round.game.rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0);
    if (round.roundNumber !== maxRoundNumber) {
      return res.status(400).json({ error: 'Cannot undo throws in a completed round' });
    }
    const lastThrow = round.bagThrows[0];
    if (!lastThrow || lastThrow.id !== existing.id) {
      return res.status(400).json({ error: 'Can only undo the most recent throw' });
    }
    await prisma.bagThrow.delete({ where: { id: existing.id } });
    await recalcRound(existing.roundId);
    const refreshed = await prisma.round.findUnique({
      where: { id: existing.roundId },
      include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
    });
    const totals = await getGameTotals(existing.gameId);
    broadcastGameUpdate(existing.gameId, { round: refreshed, totals });
    return res.json({ round: refreshed, totals });
  }

  await prisma.bagThrow.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

module.exports = router;
