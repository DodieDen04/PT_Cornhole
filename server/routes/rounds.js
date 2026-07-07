const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { recalcRound, getGameTotals } = require('../lib/scoring');
const { broadcastGameUpdate } = require('../lib/spectator');

const router = express.Router();

function isTwoVsTwo(gamePlayers) {
  return gamePlayers.length === 4;
}

function nextThrowingPair(prevPair, gamePlayers) {
  if (!isTwoVsTwo(gamePlayers)) return 1;
  return prevPair === 1 ? 2 : 1;
}

router.put('/:id/complete', authenticate, async (req, res) => {
  const round = await prisma.round.findUnique({
    where: { id: req.params.id },
    include: { game: { include: { players: true, rounds: true } } },
  });
  if (!round) return res.status(404).json({ error: 'Round not found' });
  if (round.game.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Game is not in progress' });
  }
  const maxRoundNumber = round.game.rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0);
  if (round.roundNumber !== maxRoundNumber) {
    return res.status(400).json({ error: 'Round already completed' });
  }

  await recalcRound(round.id);

  const refreshed = await prisma.round.findUnique({ where: { id: round.id } });
  const totals = await getGameTotals(round.gameId);

  const team1Total =
    totals.team1Score + (refreshed.scoringTeam === 1 ? refreshed.netPoints : 0);
  const team2Total =
    totals.team2Score + (refreshed.scoringTeam === 2 ? refreshed.netPoints : 0);

  const target = round.game.targetScore;
  const winningTeam =
    team1Total >= target ? 1 : team2Total >= target ? 2 : null;

  // Two phones can race to complete the same round (shared scoring). Both
  // pass the active-round guard, then the loser trips a unique constraint
  // (next Round's roundNumber, or GameResult's gameId). Reject it cleanly.
  try {
    if (winningTeam) {
      await prisma.game.update({
        where: { id: round.gameId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          startingTeam: refreshed.scoringTeam || round.startingTeam,
        },
      });
      await prisma.gameResult.create({
        data: {
          gameId: round.gameId,
          winningTeam,
          team1Score: team1Total,
          team2Score: team2Total,
        },
      });
      const tMatch = await prisma.tournamentMatch.findFirst({ where: { gameId: round.gameId } });
      if (tMatch) {
        const winnerId = winningTeam === 1 ? tMatch.player1Id : tMatch.player2Id;
        await prisma.tournamentMatch.update({ where: { id: tMatch.id }, data: { winnerId } });
        const remaining = await prisma.tournamentMatch.count({
          where: { tournamentId: tMatch.tournamentId, winnerId: null },
        });
        if (remaining === 0) {
          await prisma.tournament.update({
            where: { id: tMatch.tournamentId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      }
    } else {
      const newStartingTeam = refreshed.scoringTeam || round.startingTeam;
      const newPair = nextThrowingPair(round.throwingPair, round.game.players);
      await prisma.game.update({
        where: { id: round.gameId },
        data: { startingTeam: newStartingTeam },
      });
      await prisma.round.create({
        data: {
          gameId: round.gameId,
          roundNumber: round.roundNumber + 1,
          startingTeam: newStartingTeam,
          throwingPair: newPair,
        },
      });
    }
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Round already completed' });
    }
    throw err;
  }

  const game = await prisma.game.findUnique({
    where: { id: round.gameId },
    include: {
      players: { include: { player: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
      },
      result: true,
    },
  });
  const finalTotals = await getGameTotals(round.gameId);
  broadcastGameUpdate(round.gameId, {
    game: { ...game, ...finalTotals },
    winningTeam,
    by: { id: req.player.id, username: req.player.username },
  });
  res.json({
    game: { ...game, ...finalTotals },
    completedRound: refreshed,
    winningTeam,
  });
});

module.exports = router;
