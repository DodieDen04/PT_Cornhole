const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

async function loadPlayerCompetitiveGames(playerId, groupId) {
  return prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      players: { some: { playerId } },
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: {
      players: true,
      result: true,
      rounds: { include: { bagThrows: true } },
    },
  });
}

router.get('/player/:id', authenticate, async (req, res) => {
  const playerId = req.params.id;
  const groupId = req.query.groupId || null;
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const competitiveGames = await loadPlayerCompetitiveGames(playerId, groupId);

  let won = 0;
  let lost = 0;
  let totalCompetitiveThrows = 0;
  let cornholes = 0;
  let boards = 0;
  let offs = 0;
  let totalRoundPoints = 0;
  let totalRoundsWithThrows = 0;
  const streakHistory = [];

  for (const g of competitiveGames) {
    const myGp = g.players.find((gp) => gp.playerId === playerId);
    if (!myGp) continue;
    const myTeam = myGp.team;
    const winningTeam = g.result?.winningTeam;
    if (winningTeam) {
      const isWin = winningTeam === myTeam;
      if (isWin) won += 1;
      else lost += 1;
      streakHistory.push(isWin ? 'W' : 'L');
    }
    for (const r of g.rounds) {
      let didThrow = false;
      for (const t of r.bagThrows) {
        if (t.playerId !== playerId) continue;
        didThrow = true;
        totalCompetitiveThrows += 1;
        if (t.result === 'CORNHOLE') cornholes += 1;
        else if (t.result === 'BOARD') boards += 1;
        else offs += 1;
        totalRoundPoints += t.points;
      }
      if (didThrow) totalRoundsWithThrows += 1;
    }
  }

  let currentStreak = 0;
  let currentStreakType = null;
  for (const r of streakHistory) {
    if (currentStreakType == null) {
      currentStreakType = r;
      currentStreak = 1;
    } else if (r === currentStreakType) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const practiceThrows = await prisma.bagThrow.findMany({
    where: { playerId, practiceSetId: { not: null } },
    select: { result: true },
  });
  const practiceSets = await prisma.practiceSet.count({ where: { playerId } });

  let pCornholes = 0;
  let pBoards = 0;
  let pOffs = 0;
  for (const t of practiceThrows) {
    if (t.result === 'CORNHOLE') pCornholes += 1;
    else if (t.result === 'BOARD') pBoards += 1;
    else pOffs += 1;
  }

  const compTotal = totalCompetitiveThrows;
  const competitive = {
    gamesPlayed: won + lost,
    won,
    lost,
    winPct: pct(won, won + lost),
    currentStreak,
    currentStreakType,
    totalThrows: compTotal,
    cornholes,
    boards,
    offs,
    cornholePct: pct(cornholes, compTotal),
    boardPct: pct(boards, compTotal),
    offPct: pct(offs, compTotal),
    avgPointsPerRound:
      totalRoundsWithThrows > 0
        ? Math.round((totalRoundPoints / totalRoundsWithThrows) * 10) / 10
        : 0,
  };

  const pTotal = practiceThrows.length;
  const practice = {
    totalSets: practiceSets,
    totalThrows: pTotal,
    cornholes: pCornholes,
    boards: pBoards,
    offs: pOffs,
    cornholePct: pct(pCornholes, pTotal),
    boardPct: pct(pBoards, pTotal),
    offPct: pct(pOffs, pTotal),
  };

  const trend = [];
  const trendSource = [];
  for (const g of competitiveGames) {
    let throws = 0;
    let cornholes = 0;
    for (const r of g.rounds) {
      for (const t of r.bagThrows) {
        if (t.playerId !== playerId) continue;
        throws += 1;
        if (t.result === 'CORNHOLE') cornholes += 1;
      }
    }
    if (throws === 0) continue;
    trendSource.push({
      mode: 'COMPETITIVE',
      completedAt: g.completedAt,
      cornholePct: Math.round((cornholes / throws) * 1000) / 10,
      throws,
    });
  }
  const practiceSessions = await prisma.game.findMany({
    where: {
      mode: 'PRACTICE',
      status: 'COMPLETED',
      players: { some: { playerId } },
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: { practiceSets: { where: { playerId }, include: { bagThrows: true } } },
    take: 20,
  });
  for (const g of practiceSessions) {
    let throws = 0;
    let cornholes = 0;
    for (const s of g.practiceSets) {
      for (const t of s.bagThrows) {
        throws += 1;
        if (t.result === 'CORNHOLE') cornholes += 1;
      }
    }
    if (throws === 0) continue;
    trendSource.push({
      mode: 'PRACTICE',
      completedAt: g.completedAt,
      cornholePct: Math.round((cornholes / throws) * 1000) / 10,
      throws,
    });
  }
  trendSource.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  trend.push(...trendSource.slice(-20));

  res.json({
    stats: {
      player: { id: player.id, username: player.username },
      competitive,
      practice,
      trend,
    },
  });
});

router.get('/heatmap', authenticate, async (req, res) => {
  const { playerId, mode, dateFrom, dateTo, result, groupId } = req.query;
  if (!playerId) return res.status(400).json({ error: 'playerId required' });

  const where = { playerId };
  if (result && ['CORNHOLE', 'BOARD', 'OFF'].includes(result)) {
    where.result = result;
  }
  if (mode === 'COMPETITIVE') where.roundId = { not: null };
  else if (mode === 'PRACTICE') where.practiceSetId = { not: null };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (groupId) where.game = { groupId };

  const throws = await prisma.bagThrow.findMany({
    where,
    select: { boardX: true, boardY: true, result: true, createdAt: true },
    take: 5000,
  });
  res.json({
    throws: throws.map((t) => ({ x: t.boardX, y: t.boardY, result: t.result })),
  });
});

router.get('/head-to-head', authenticate, async (req, res) => {
  const { player1Id, player2Id, groupId } = req.query;
  if (!player1Id || !player2Id) {
    return res.status(400).json({ error: 'player1Id and player2Id required' });
  }
  if (player1Id === player2Id) {
    return res.status(400).json({ error: 'Players must be different' });
  }

  const games = await prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      AND: [
        { players: { some: { playerId: player1Id } } },
        { players: { some: { playerId: player2Id } } },
      ],
      ...(groupId ? { groupId } : {}),
    },
    include: { players: true, result: true },
  });

  let p1Wins = 0;
  let p2Wins = 0;
  let totalGames = 0;
  for (const g of games) {
    const p1 = g.players.find((p) => p.playerId === player1Id);
    const p2 = g.players.find((p) => p.playerId === player2Id);
    if (!p1 || !p2) continue;
    if (p1.team === p2.team) continue;
    const winning = g.result?.winningTeam;
    if (!winning) continue;
    totalGames += 1;
    if (winning === p1.team) p1Wins += 1;
    else if (winning === p2.team) p2Wins += 1;
  }
  res.json({ player1Id, player2Id, player1Wins: p1Wins, player2Wins: p2Wins, totalGames });
});

router.get('/leaderboard', authenticate, async (req, res) => {
  const minGames = Math.max(1, Number(req.query.minGames) || 1);
  const groupId = req.query.groupId || null;

  const players = await prisma.player.findMany({ orderBy: { username: 'asc' } });
  const games = await prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      ...(groupId ? { groupId } : {}),
    },
    include: { players: true, result: true },
  });

  const summary = {};
  for (const p of players) summary[p.id] = { id: p.id, username: p.username, games: 0, wins: 0 };

  for (const g of games) {
    const winning = g.result?.winningTeam;
    if (!winning) continue;
    for (const gp of g.players) {
      const s = summary[gp.playerId];
      if (!s) continue;
      s.games += 1;
      if (gp.team === winning) s.wins += 1;
    }
  }

  const leaderboard = Object.values(summary)
    .map((s) => ({
      ...s,
      losses: s.games - s.wins,
      winPct: pct(s.wins, s.games),
    }))
    .filter((s) => s.games >= minGames)
    .sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.wins - a.wins;
    });

  res.json({ leaderboard, minGames });
});

module.exports = router;
