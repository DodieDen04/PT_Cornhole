const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

function roundRobinPairs(playerIds) {
  const pairs = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairs.push([playerIds[i], playerIds[j]]);
    }
  }
  return pairs;
}

router.post('/', authenticate, async (req, res) => {
  const { name, playerIds, targetScore } = req.body || {};
  if (!Array.isArray(playerIds) || playerIds.length < 3 || playerIds.length > 16) {
    return res.status(400).json({ error: 'Need 3 to 16 players' });
  }
  const target = Number(targetScore) || 21;
  if (target < 5 || target > 99) return res.status(400).json({ error: 'Invalid target score' });

  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  if (players.length !== playerIds.length) {
    return res.status(400).json({ error: 'Unknown player(s)' });
  }

  const pairs = roundRobinPairs(playerIds);
  const tournament = await prisma.tournament.create({
    data: {
      name: name?.trim() || null,
      format: 'ROUND_ROBIN',
      targetScore: target,
      participants: {
        create: playerIds.map((pid, i) => ({ playerId: pid, seedNumber: i + 1 })),
      },
      matches: {
        create: pairs.map(([p1, p2], i) => ({
          player1Id: p1,
          player2Id: p2,
          matchOrder: i + 1,
        })),
      },
    },
    include: {
      participants: { include: { player: true } },
      matches: true,
    },
  });
  res.json({ tournament });
});

router.get('/', authenticate, async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      participants: { include: { player: true } },
      _count: { select: { matches: true } },
    },
    take: 50,
  });
  res.json({ tournaments });
});

router.get('/:id', authenticate, async (req, res) => {
  const t = await prisma.tournament.findUnique({
    where: { id: req.params.id },
    include: {
      participants: { include: { player: true } },
      matches: {
        orderBy: { matchOrder: 'asc' },
        include: {
          player1: true,
          player2: true,
          winner: true,
          game: { include: { result: true } },
        },
      },
    },
  });
  if (!t) return res.status(404).json({ error: 'Not found' });

  const standings = t.participants.map((p) => ({
    playerId: p.playerId,
    username: p.player.username,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }));
  const idx = {};
  for (let i = 0; i < standings.length; i++) idx[standings[i].playerId] = i;

  for (const m of t.matches) {
    if (!m.game?.result) continue;
    const r = m.game.result;
    const p1 = standings[idx[m.player1Id]];
    const p2 = standings[idx[m.player2Id]];
    if (!p1 || !p2) continue;
    p1.pointsFor += r.team1Score;
    p1.pointsAgainst += r.team2Score;
    p2.pointsFor += r.team2Score;
    p2.pointsAgainst += r.team1Score;
    if (m.winnerId === m.player1Id) {
      p1.wins += 1;
      p2.losses += 1;
    } else if (m.winnerId === m.player2Id) {
      p2.wins += 1;
      p1.losses += 1;
    }
  }
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });

  res.json({ tournament: t, standings });
});

router.post('/:id/matches/:matchId/start', authenticate, async (req, res) => {
  const { team1Colour = 'YELLOW', team2Colour = 'RED' } = req.body || {};
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  if (tournament.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Tournament not in progress' });
  }

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: req.params.matchId },
    include: { game: true },
  });
  if (!match || match.tournamentId !== tournament.id) {
    return res.status(404).json({ error: 'Match not found' });
  }
  if (match.gameId && match.game?.status !== 'ABANDONED') {
    return res.status(400).json({ error: 'Match already has a game', gameId: match.gameId });
  }

  const game = await prisma.game.create({
    data: {
      mode: 'COMPETITIVE',
      status: 'IN_PROGRESS',
      targetScore: tournament.targetScore,
      team1Colour,
      team2Colour,
      startingTeam: 1,
      players: {
        create: [
          { playerId: match.player1Id, team: 1, position: 1 },
          { playerId: match.player2Id, team: 2, position: 1 },
        ],
      },
      rounds: { create: [{ roundNumber: 1, startingTeam: 1, throwingPair: 1 }] },
    },
  });
  await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { gameId: game.id, winnerId: null },
  });
  res.json({ gameId: game.id });
});

module.exports = router;
